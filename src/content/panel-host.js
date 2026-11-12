/*
 * BibleBoost — the side panel's host
 * What the notes panel costs a bible.com page. While it is closed that is one small button and nothing
 * else: bible.com re-renders constantly and most page loads never open the panel, so a document, a
 * stylesheet and a script on every one of them would be paying for something nobody asked for. The
 * panel itself is an iframe, created the first time it is opened and then kept (T-017).
 *
 * It is an iframe for the CSS isolation and because its own DOM churn is then a different document,
 * which the page observer cannot see. See work/understandings/extension/01-architecture.md, rule 4.
 *
 * Nothing here reads the panel's contents or knows what it shows. It places the box, remembers whether
 * it was open and pinned and how wide, narrows the page beside a pinned panel (T-018), lets the user
 * drag its edge (T-019), tells it which theme bible.com is in (T-020), and carries messages.
 *
 * Classic script, and the manifest runs it AFTER bible-dom.js, which it reads as it loads. content.js
 * runs before this file and reaches it through BB.panel?. at the moment of each refresh.
 */
var BB = (typeof BB !== 'undefined') ? BB : {};

(() => {
  const { parseUrl, columnEls, firstSpans, verseLabel, VID_RE } = BB.dom;

  // In storage.local and not storage.sync, because this is per-device UI state: a panel left open on
  // the desktop says nothing about a phone-sized window elsewhere, and sync's write quota is for the
  // settings that do follow the user (02-storage-model.md).
  //
  // panelWidth is a percentage of the window and not pixels (T-019 R3), so that a width chosen on a
  // laptop means the same share of an external monitor. content.css clamps it to 280px and 50%.
  const WIDTH_DEFAULT = 30;
  const DEFAULTS = { panelOpen: false, panelPinned: false, panelWidth: WIDTH_DEFAULT };
  const store = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) || null;

  // Worked out once, here, while the extension context is certain to be alive. After the extension is
  // reloaded a content script already in a tab is orphaned and chrome.runtime calls throw, and a click
  // on the tab must not be what finds that out.
  const PANEL_URL = chrome.runtime.getURL('src/ui/panel.html');
  const PANEL_ORIGIN = new URL(PANEL_URL).origin;

  // The width content.css treats as a phone, where the panel covers the whole window and the squeeze
  // rule does not exist (T-017's R10, T-018's R6). Keep the two in step. The stylesheet alone decides
  // whether the page is narrowed; this copy is for telling the panel whether to offer the pin, and for
  // not holding the reader's place through a squeeze that is not going to happen.
  const NARROW = window.matchMedia('(max-width: 767px)');

  const html = document.documentElement;

  let state = { ...DEFAULTS };
  let ready = !store; // never act on or persist anything until the stored state has actually loaded

  let tab = null;
  let box = null;
  let frame = null;
  let grip = null;
  let frameReady = false;

  // ---------- Remembering ----------
  // Only what really changed is written, the remember() pattern from content.js. The try is for the
  // orphaned script above, where set() throws "Extension context invalidated": the panel should still
  // open and close in that tab, and only the memory of it is lost.
  function persist(patch) {
    const changed = Object.entries(patch).filter(([key, value]) => state[key] !== value);
    if (!changed.length) return;
    state = { ...state, ...patch };
    try {
      store?.set(Object.fromEntries(changed), () => void chrome.runtime.lastError);
    } catch (err) {
      console.debug('[BibleBoost] panel: could not remember its state', err);
    }
  }

  // ---------- Talking to the panel ----------
  // Silently nothing until the panel has said it is listening, since a message posted any earlier is
  // simply lost. 'ready' below sends the state again for exactly that reason.
  //
  // The target origin is the panel's own, so that a frame that has somehow navigated away is not
  // handed anything.
  function send(msg) {
    if (frameReady) frame.contentWindow.postMessage(msg, PANEL_ORIGIN);
  }

  // canPin is worked out here because the panel cannot: a media query inside the frame measures the
  // frame, which is 30% of a wide window and so reads as narrow there too.
  const announce = () => send({
    bb: 'state', open: state.panelOpen, pinned: state.panelPinned, canPin: !NARROW.matches,
  });

  // Own-property only, so that { bb: 'constructor' } finds nothing, the same care the worker's router
  // takes with msg.type.
  //
  // pin writes storage on the panel's say-so, which is safe only because onMessage below checks the
  // sender's window and not just its origin (B-012).
  const HANDLERS = {
    ready() { frameReady = true; announce(); relayTheme(true); },
    close() { setOpen(false); },
    pin(msg) { if (typeof msg.pinned === 'boolean') setPinned(msg.pinned); },
  };

  // A real barrier in this direction, unlike the panel's check of the messages going the other way,
  // but only with both halves. The origin alone is not one. panel.html is web-accessible to
  // bible.com, which is what lets this file frame it, and it lets the page frame a second copy just
  // the same. That copy runs the real panel.js, so its 'ready' and its × arrive here carrying the
  // extension's origin (B-012). The source is what says the message came from the frame built above.
  //
  // contentWindow is read at each message and never kept. render() puts a removed box back, which
  // reloads the frame, and the window is a different one after that.
  //
  // See work/understandings/extension/03-messaging.md for why the two sides are not symmetric.
  function onMessage(e) {
    if (e.origin !== PANEL_ORIGIN || e.source !== frame.contentWindow) return;
    const type = e.data?.bb;
    if (typeof type === 'string' && Object.hasOwn(HANDLERS, type)) HANDLERS[type](e.data);
  }

  // ---------- Theme ----------
  // bible.com puts html.light or html.dark on <html> by its own choice, independently of the OS, and
  // the frame is a document of its own that cannot see that class, so the panel would otherwise follow
  // the OS and clash with a dark page on a light machine (T-020). theme.css inside the frame matches
  // only those two classes, so a class is what gets relayed, and the panel sets the same one on its own
  // <html>.
  //
  // The class first and the OS only when there is none, R2's order. bible.com can paint before it has
  // set a class, and that is the moment the OS is the best guess there is.
  const DARK_OS = window.matchMedia('(prefers-color-scheme: dark)');

  function pageTheme() {
    if (html.classList.contains('dark')) return 'dark';
    if (html.classList.contains('light')) return 'light';
    return DARK_OS.matches ? 'dark' : 'light';
  }

  // Where the theme goes. A list and not one postMessage, so that a second host can be added without
  // rewriting the relay (R7). It has one entry, the frame, and T-050's native side panel is not going
  // to be another: T-050 R8 has that panel follow the browser's theme, because it sits outside the
  // page, and its context reaches it through storage.local rather than through this file.
  const THEME_TARGETS = [send];

  // The last theme relayed, so that a class change on <html> that leaves the theme alone costs one
  // comparison and posts nothing. force is for 'ready', when a frame that has just loaded has heard
  // nothing yet.
  let relayedTheme = null;

  function relayTheme(force = false) {
    const theme = pageTheme();
    if (theme === relayedTheme && !force) return;
    relayedTheme = theme;
    THEME_TARGETS.forEach((post) => post({ bb: 'theme', theme }));
  }

  // Its own observer, and on <html>, because the page observer in content.js watches body and <html>
  // is not inside body: it has never seen a theme change, and CSS alone has been coping. Widening that
  // observer to <html> would put every theme change through align() for nothing (R1). Only class, so
  // the inline --bb-squeeze and --bb-panel-width this file writes on <html> are not heard here either.
  //
  // Started the first time the panel is built and never before, because a page where the panel is
  // never opened should still cost one button. The media query is for a page with no class at all,
  // where the OS is what decides.
  let themeWatched = false;

  function watchTheme() {
    if (themeWatched) return;
    themeWatched = true;
    new MutationObserver(() => relayTheme())
      .observe(html, { attributes: true, attributeFilter: ['class'] });
    DARK_OS.addEventListener('change', () => relayTheme());
  }

  // The frame's address carries the theme as well as the message, because the message can only be sent
  // once the frame says it is listening, by which time it has painted (R4). theme-boot.js reads this
  // before the panel's body exists. The page can frame its own copy with any hash it likes (B-012), and
  // all that buys it is the colour of a panel it made, so it is fit for display and nothing else.
  const panelSrc = () => `${PANEL_URL}#theme=${pageTheme()}`;

  // ---------- Building ----------
  // A real button, for what that gives away for free: Tab reaches it, and Enter and Space click it.
  // One name whichever way it will go, because aria-expanded is what says which way that is, and the
  // visual state hangs off the same attribute so that the two cannot drift apart.
  //
  // A letter rather than a drawn icon, matching the dock's own P and A at rest.
  function buildTab() {
    const el = document.createElement('button');
    el.type = 'button';
    el.id = 'bb-panel-tab';
    el.setAttribute('data-bb-own', '');
    el.setAttribute('aria-label', 'BibleBoost notes');
    el.title = 'Open or close BibleBoost notes';
    el.textContent = 'B';
    el.addEventListener('click', toggle);
    return el;
  }

  // The box is separate from the frame because an iframe is a replaced element: given top and bottom
  // it keeps its intrinsic 150px rather than stretching between them, so something else has to be the
  // box and the frame fills it.
  //
  // src is set before the frame goes in, because inserting one without a src loads about:blank first,
  // and that is a whole extra document.
  //
  // data-bb-own on each of the three (R5). The listener and the theme observer are added here and not
  // at load, so that the page's own message traffic and class writes cost nothing on the pages where
  // the panel is never opened.
  function buildPanel() {
    box = document.createElement('div');
    box.id = 'bb-panel';
    box.setAttribute('data-bb-own', '');
    frame = document.createElement('iframe');
    frame.id = 'bb-panel-frame';
    frame.setAttribute('data-bb-own', '');
    frame.title = 'BibleBoost notes';
    frame.src = panelSrc();
    box.append(frame);
    // The grip goes in ahead of the box, so that Tab from the edge tab reaches the handle next and only
    // then the panel's own controls, rather than after every one of them.
    grip = buildGrip();
    document.body.append(grip, box);
    window.addEventListener('message', onMessage);
    watchTheme();
  }

  // The drag handle on the panel's left edge (T-019). Its own element beside the box, and not inside it,
  // because the box has overflow: hidden to round the frame's corners (B-019), and that would clip a
  // hit area reaching out over the page. content.css lays it across the edge, under the tab, so the tab
  // still takes its own clicks.
  //
  // The host owns it and not the panel (R4): a pointer dragging the edge leaves the frame at once, and
  // the frame's document would stop hearing about it. A separator with a value is the ARIA pattern for
  // a splitter between two panes, and tabindex is what lets the keyboard reach it (R8). The value is the
  // panel's share of the window, so Left, which moves the edge left, raises it.
  function buildGrip() {
    const el = document.createElement('div');
    el.id = 'bb-panel-grip';
    el.setAttribute('data-bb-own', '');
    el.tabIndex = 0;
    el.setAttribute('role', 'separator');
    el.setAttribute('aria-orientation', 'vertical');
    el.setAttribute('aria-controls', 'bb-panel');
    el.setAttribute('aria-label', 'Resize BibleBoost notes');
    el.setAttribute('aria-valuemax', String(WIDTH_MAX));
    el.title = 'Drag to resize. Double-click to reset';
    el.addEventListener('pointerdown', startDrag);
    el.addEventListener('pointermove', moveDrag);
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('lostpointercapture', endDrag);
    el.addEventListener('dblclick', resetWidth);
    el.addEventListener('keydown', onGripKey);
    return el;
  }

  // ---------- Squeezing the page ----------
  // Pinned and open on a reader page, the page is narrowed so that the panel sits beside it instead of
  // over the second column. This file only says whether: it writes --bb-squeeze on <html> as 1, and
  // the one rule in content.css that reads it supplies the width, the breakpoint and the transition.
  // Without that stylesheet the property does nothing, so it cannot narrow a page on its own.
  const squeezing = () => !!parseUrl() && state.panelOpen && state.panelPinned;

  // The two properties this file keeps on <html>: --bb-squeeze, and --bb-panel-width while the panel is
  // open (T-019). <html> because it is the one element that is an ancestor of the tab, the panel, the
  // grip and body, so one value moves all four.
  //
  // Written only when it changes, because render() runs at the end of every refresh(). No write is
  // observed: <html> is outside body, and the page observer only watches class.
  //
  // T-018 R4: nothing of ours stays on <html> afterwards. bible.com usually keeps an inline color-scheme
  // there, but where it has no style attribute of its own, removing the last property would leave an
  // empty style="" behind, so that goes too.
  function setRootProp(name, value) {
    if (html.style.getPropertyValue(name) === (value ?? '')) return;
    if (value !== null) {
      html.style.setProperty(name, value);
      return;
    }
    html.style.removeProperty(name);
    if (!html.getAttribute('style')) html.removeAttribute('style');
  }

  const setSqueeze = (on) => setRootProp('--bb-squeeze', on ? '1' : null);

  // A pin restored at load is the page settling, not a change the user made, so it is not animated.
  // getAnimations() brings styles up to date before it answers, so the transition that setting the
  // property has just started is already in the list to be finished.
  function settle() {
    for (const a of document.body.getAnimations()) {
      if (a.transitionProperty === 'padding-right') a.finish();
    }
  }

  // ---------- Keeping the reader's place ----------
  // R8. Narrowing the page re-wraps every line above the verse being read, and with nothing done the
  // text slides away under a scroll position that has not changed. Measured on 2026-11-10 at 1400x900:
  // narrowing body moved verse 10 of Exodus 13 from 152px to 1241px, with scrollY still 1489.
  //
  // Chrome's scroll anchoring exists to prevent exactly that, and it stood aside. A change of padding on
  // an ancestor of the anchor is one of the things that switch it off, and body is an ancestor of
  // everything. It stood aside for padding on html and on main#main too, so no other target would have
  // let the browser do this.
  //
  // So this file holds one element still itself, for long enough to cover the layout that keeps moving
  // after the switch: every frame of the 0.2s transition, schedule()'s 80ms throttle, and the align()
  // pass that follows, which adds its gaps and moves the text again. A frame loop corrects as it goes,
  // and render(), which content.js calls straight after align(), corrects once more, so that a pass
  // landing between two frames is not left on screen.
  const HOLD_MS = 600;

  // Anything the user does to the page means they have moved on, and a hold still running would drag
  // them back, so any of these ends it. Captured and passive, because they only have to be heard.
  const LET_GO = ['wheel', 'pointerdown', 'keydown'];

  // A third of the way down the window, and not its top, because bible.com's sticky header and version
  // row cover the first 129px at 1400x900 and publish no height for either
  // (05-theme-and-page-chrome.md). A verse under them is not the one being read.
  const READING_LINE = 1 / 3;

  let hold = null;

  // The top of an element's first line box, or undefined when it has none to measure, as when it has
  // been hidden. The same reading align()'s topOf() takes, so that what is held still is what alignment
  // lines up.
  const lineTop = (el) => el.getClientRects()[0]?.top;

  // Which verse the user is reading, as { el, top }: the element to hold still, and where. null when
  // there is nothing to hold, such as a reader page whose columns have not rendered.
  //
  // The verse is the last one whose number is at or above the reading line, which makes it the one
  // whose text crosses that line. Its number, and not the verse element, is what gets held: the number
  // sits after the spacer align() puts in front of a verse, so a gap that grows moves it exactly as it
  // moves the text. The verse element's own box would start at the spacer and stay put. A verse whose
  // number has been switched off is held by its first line instead.
  //
  // The primary column, found by its vid and never by position (03-columns-and-versions.md), because it
  // is the one every reader page has. After align() the other column's verses start level with it.
  // The first verse stands in when the reader is above all of them, at the top of the chapter.
  function readAnchor() {
    const id = parseUrl()?.id;
    const cols = columnEls();
    const col = cols.find((c) => c.getAttribute('class').match(VID_RE)[1] === id) || cols[0];
    if (!col) return null;
    const line = innerHeight * READING_LINE;
    let anchor = null;
    for (const verse of firstSpans(col).values()) {
      const label = verseLabel(verse);
      const el = label?.getClientRects().length ? label : verse;
      const top = lineTop(el);
      if (top === undefined) continue;
      if (anchor && top > line) break;
      anchor = { el, top };
    }
    return anchor;
  }

  function holdPosition() {
    const anchor = readAnchor();
    if (!anchor) return;
    const running = !!hold;
    hold = { ...anchor, until: performance.now() + HOLD_MS };
    if (running) return;
    LET_GO.forEach((type) => window.addEventListener(type, release, { capture: true, passive: true }));
    requestAnimationFrame(tick);
  }

  // Whole pixels only, so that sub-pixel layout noise does not turn into a scroll every frame. An
  // element that has gone, or can no longer be measured, ends the hold rather than steering by nothing.
  function keepPlace() {
    if (!hold) return;
    const now = hold.el.isConnected ? lineTop(hold.el) : undefined;
    if (now === undefined || performance.now() > hold.until) {
      release();
      return;
    }
    const drift = now - hold.top;
    if (Math.abs(drift) >= 1) window.scrollBy(0, drift);
  }

  function tick() {
    keepPlace();
    if (hold) requestAnimationFrame(tick);
  }

  function release() {
    hold = null;
    LET_GO.forEach((type) => window.removeEventListener(type, release, { capture: true }));
  }

  // ---------- Resizing ----------
  // R2. 280px is the narrowest the compact list stays readable at, and past half the window it is the
  // reader that suffers. content.css applies the same two limits with clamp(), which is what keeps a
  // saved width honest when the window itself changes size, with no script running. These copies are
  // for what a drag or a key press stores, and for the value the grip reports.
  const WIDTH_MIN_PX = 280;
  const WIDTH_MAX = 50;
  const WIDTH_STEP = 2;

  // A held arrow key repeats about thirty times a second, and each commit narrows a pinned page and so
  // re-runs align(). Keys therefore only preview, and the width is committed once they have been quiet
  // this long, which is R6's throttle applied to the keyboard as well as the pointer.
  const KEY_SETTLE_MS = 300;

  // The reset's ease in content.css is 0.2s. The attribute that allows it stays a little longer.
  const EASE_MS = 250;

  // The width a percentage is taken of: the window less its scrollbar. It is the same base for the fixed
  // panel's width and for body's padding (T-018 measured both as 1385px at 1400x900), which is why the
  // page's new edge and the panel's meet.
  const viewport = () => html.clientWidth;

  // Rounded to a tenth, so that a pixel-level drag does not store a fourteen-digit percentage.
  function clampWidth(pct) {
    const min = Math.min(WIDTH_MAX, (WIDTH_MIN_PX / viewport()) * 100);
    return Math.round(Math.min(WIDTH_MAX, Math.max(min, pct)) * 10) / 10;
  }

  let drag = null;    // { id, offset } while a pointer holds the grip
  let preview = null; // the width being shown during a drag or key presses, not yet committed
  let previewFrame = 0;
  let keyTimer = 0;

  // R6. While the edge moves, only BibleBoost's own three elements change. The width is written on
  // each of them, where it outranks the one inherited from <html>, and body's padding still reads the
  // old value from <html>. So a pinned page does not reflow, and align() is not re-run, until the
  // width is committed once at the end. The panel overlaps the page, or leaves a gap beside it, for the
  // length of the drag, and that is the cheap preview R6 asks for.
  //
  // At most once a frame. pointermove can arrive several times between two frames, and only the last
  // position is worth drawing.
  function previewWidth(pct) {
    preview = clampWidth(pct);
    if (previewFrame) return;
    previewFrame = requestAnimationFrame(() => {
      previewFrame = 0;
      if (preview === null) return;
      for (const el of [box, tab, grip]) el.style.setProperty('--bb-panel-width', `${preview}%`);
      grip.setAttribute('aria-valuenow', String(Math.round(preview)));
    });
  }

  // The one write that moves the page. Its place is held first, while the verse being read is still
  // where the user last saw it, as apply() does for a pin: a width change while pinned re-wraps the page
  // exactly as pinning does. The three overrides come off in the same task as <html> gets the new
  // value, so no frame ever shows the old width.
  //
  // settle() then finishes body's padding transition at once. Animating it would reflow the whole page
  // on every frame of 0.2s for a width the user has already seen in the panel, and R9 wants no motion
  // on a drag. ease is the reset's way of keeping the transition.
  function commitWidth(pct, ease = false) {
    cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    clearTimeout(keyTimer);
    keyTimer = 0;
    preview = null;
    const width = clampWidth(pct);
    if (width !== state.panelWidth && squeezing() && !NARROW.matches) holdPosition();
    persist({ panelWidth: width });
    for (const el of [box, tab, grip]) el.style.removeProperty('--bb-panel-width');
    render();
    if (!ease) settle();
  }

  // R7 and R8's Home. The only resize that animates (R9), by way of data-bb-easing, which content.css
  // answers with a transition on the panel, the tab and the grip, and which it drops again under
  // prefers-reduced-motion along with body's own.
  function resetWidth() {
    for (const el of [box, tab, grip]) el.setAttribute('data-bb-easing', '');
    commitWidth(WIDTH_DEFAULT, true);
    setTimeout(() => [box, tab, grip].forEach((el) => el.removeAttribute('data-bb-easing')), EASE_MS);
  }

  // Pointer capture keeps the moves coming to the grip after the pointer has crossed into the frame or
  // out over the page (R4). The frame stops taking pointer events as well (R5): it is a document of its
  // own, in its own process, and the drag should not rest on capture alone reaching across into it.
  // Both are undone in endDrag, which lostpointercapture also reaches, so a drag that the browser cancels
  // still gives the frame back its pointer.
  //
  // offset is where on the grip it was taken, so the edge does not jump to the pointer when it first
  // moves. preventDefault on the press keeps the drag from selecting the page's text on the way.
  function startDrag(e) {
    if (e.button !== 0 || drag) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, offset: box.getBoundingClientRect().left - e.clientX };
    grip.setAttribute('data-bb-dragging', '');
    frame.style.pointerEvents = 'none';
  }

  // The panel is fixed to the right of the window, so its width is the distance from its left edge to
  // the window's right, which the viewport ends at.
  function moveDrag(e) {
    if (e.pointerId !== drag?.id) return;
    const left = e.clientX + drag.offset;
    previewWidth(((viewport() - left) / viewport()) * 100);
  }

  // pointerup and then lostpointercapture both arrive for an ordinary release, and only the first one
  // finds a drag to end. A press that never moved previewed nothing and commits nothing, which is what
  // keeps a double-click from writing anything before its reset.
  function endDrag(e) {
    if (e.pointerId !== drag?.id) return;
    drag = null;
    grip.removeAttribute('data-bb-dragging');
    frame.style.removeProperty('pointer-events');
    if (preview !== null) commitWidth(preview);
  }

  // R8. No modifiers, so that Alt+Left, the browser's Back, still goes back.
  function onGripKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === 'Home') {
      resetWidth();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const from = preview ?? clampWidth(state.panelWidth);
      previewWidth(from + (e.key === 'ArrowLeft' ? WIDTH_STEP : -WIDTH_STEP));
      clearTimeout(keyTimer);
      keyTimer = setTimeout(() => commitWidth(preview ?? state.panelWidth), KEY_SETTLE_MS);
    } else {
      return;
    }
    e.preventDefault();
  }

  // ---------- Rendering ----------
  // Everything on the page follows from the state through here, and it is what content.js calls at the
  // end of every refresh(), so the tab comes and goes with client-side navigation with no observer or
  // poll of its own.
  //
  // Away from a reader page this hides rather than removes (R8). Taking an iframe out of the document
  // destroys what is inside it, so going home and coming back would otherwise reload the panel. hidden
  // and aria-expanded are not observed, since the page observer only watches class, and the appended
  // roots are ignored by the T-004 guard because of their marker.
  //
  // isConnected in case something does take them away. Putting the box back does reload the frame, so
  // frameReady starts over and the panel's new 'ready' sets it again. The address is rewritten first,
  // while the frame is detached and so loads nothing, so that the reload paints in today's theme and
  // not the one the frame was first built in.
  //
  // data-bb-pinned is the panel's look, and follows the pin whether or not the panel is open or the
  // window wide. The squeeze is the page's, and only while open on a reader page, so leaving a reader
  // page by client-side navigation puts the page back. keepPlace() is last because content.js calls
  // this straight after align() has moved the text again.
  //
  // The width goes on <html> only while the panel shows, since nothing else reads it, and so that a
  // closed panel leaves nothing of ours there (T-018 R4). The grip shows and hides with the box, and
  // reports the share content.css will actually draw, which is the stored one clamped to this window.
  function render() {
    if (!ready) return;
    const onReader = !!parseUrl();
    if (!tab) {
      if (!onReader) return;
      tab = buildTab();
    }
    if (!tab.isConnected) document.body.append(tab);
    if (onReader && state.panelOpen && !box) buildPanel();
    if (grip && !grip.isConnected) document.body.append(grip);
    if (box && !box.isConnected) {
      frameReady = false;
      frame.src = panelSrc();
      document.body.append(box);
    }
    const shown = onReader && state.panelOpen;
    tab.hidden = !onReader;
    tab.setAttribute('aria-expanded', String(state.panelOpen));
    if (box) {
      box.hidden = !shown;
      box.toggleAttribute('data-bb-pinned', state.panelPinned);
      grip.hidden = !shown;
      if (shown && preview === null) {
        grip.setAttribute('aria-valuemin', String(Math.round(clampWidth(0))));
        grip.setAttribute('aria-valuenow', String(Math.round(clampWidth(state.panelWidth))));
      }
    }
    setRootProp('--bb-panel-width', shown ? `${state.panelWidth}%` : null);
    setSqueeze(squeezing());
    keepPlace();
  }

  // ---------- Opening, closing and pinning ----------
  // Both go through apply(), so that anything that moves the page holds the reader's place first, while
  // the verse being read is still where the user last saw it. The page moves when the squeeze changes on
  // a window wide enough for content.css to apply it: pinning or unpinning an open panel, and opening or
  // closing a pinned one.
  function apply(patch) {
    const was = squeezing();
    persist(patch);
    if (squeezing() !== was && !NARROW.matches) holdPosition();
    render();
    announce();
  }

  // Focus is only moved when it would otherwise be lost, which is when it was inside the frame that is
  // about to disappear, or on the grip that goes with it. Inside the frame, the top document's
  // activeElement is the iframe element itself.
  //
  // Nothing moves focus into the panel on the way in. An open restored at page load must not take focus
  // from the reader, and Alt+P / A / S only reach content.js while focus is on the page.
  function setOpen(open) {
    if (!ready || !parseUrl()) return;
    const inside = frame && (document.activeElement === frame || document.activeElement === grip);
    if (!open && inside) tab.focus({ preventScroll: true });
    apply({ panelOpen: open });
  }

  // A pin is kept below 768px too, where it changes nothing on the page, so that the panel sits beside
  // the page again as soon as the window is wide enough.
  function setPinned(pinned) {
    if (!ready || !parseUrl()) return;
    apply({ panelPinned: pinned });
  }

  const open = () => setOpen(true);
  const close = () => setOpen(false);
  const toggle = () => setOpen(!state.panelOpen);

  // ---------- Init ----------
  // Being open is what creates the iframe, so a panel left open does load it with the page, and that is
  // what R4 asks for. It is still never created for a panel that has not been opened.
  //
  // A stored width that is not a positive number is ignored rather than trusted. Nothing but this file
  // writes it, but storage outlives versions of this file, and a NaN here would reach content.css as
  // "NaN%", which invalidates the declaration and leaves the panel with no width at all.
  if (store) {
    store.get(DEFAULTS, (stored) => {
      state = { ...DEFAULTS, ...stored };
      if (!(Number.isFinite(state.panelWidth) && state.panelWidth > 0)) state.panelWidth = WIDTH_DEFAULT;
      ready = true;
      render();
      settle();
    });
  } else {
    render();
  }

  // The stylesheet applies or drops the squeeze by itself as the window crosses 768px. The panel only
  // has to be told whether to show its pin.
  NARROW.addEventListener('change', announce);

  // R4 on the way out. A page being thrown away takes the properties with it anyway, but one going into
  // the back/forward cache would keep them, so they are taken off here. If the page comes back from
  // that cache with the panel still open and pinned, the ordinary route puts them back, without
  // animating, for the same reason as at load.
  window.addEventListener('pagehide', () => {
    setSqueeze(false);
    setRootProp('--bb-panel-width', null);
  });
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    render();
    settle();
  });

  // open is what T-014's Save & open panel button tests for, so defining it is what turns that on.
  BB.panel = { open, close, toggle, refresh: render };
})();
