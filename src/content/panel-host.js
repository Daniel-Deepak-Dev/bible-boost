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
 * it was open and pinned, narrows the page beside a pinned panel (T-018), and carries messages. The
 * width is T-019's.
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
  const DEFAULTS = { panelOpen: false, panelPinned: false };
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
    ready() { frameReady = true; announce(); },
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
  // data-bb-own on each of the three (R5). The listener is added here and not at load, so that the
  // page's own message traffic costs nothing on the pages where the panel is never opened.
  function buildPanel() {
    box = document.createElement('div');
    box.id = 'bb-panel';
    box.setAttribute('data-bb-own', '');
    frame = document.createElement('iframe');
    frame.id = 'bb-panel-frame';
    frame.setAttribute('data-bb-own', '');
    frame.title = 'BibleBoost notes';
    frame.src = PANEL_URL;
    box.append(frame);
    document.body.append(box);
    window.addEventListener('message', onMessage);
  }

  // ---------- Squeezing the page ----------
  // Pinned and open on a reader page, the page is narrowed so that the panel sits beside it instead of
  // over the second column. This file only says whether: it writes --bb-squeeze on <html> as 1, and
  // the one rule in content.css that reads it supplies the width, the breakpoint and the transition.
  // Without that stylesheet the property does nothing, so it cannot narrow a page on its own.
  const squeezing = () => !!parseUrl() && state.panelOpen && state.panelPinned;

  // Written only when it changes, because render() runs at the end of every refresh(). Neither write is
  // observed: <html> is outside body, and the page observer only watches class.
  //
  // R4: nothing of ours stays on <html> afterwards. bible.com usually keeps an inline color-scheme
  // there, but where it has no style attribute of its own, removing the last property would leave an
  // empty style="" behind, so that goes too.
  function setSqueeze(on) {
    if (on === (html.style.getPropertyValue('--bb-squeeze') === '1')) return;
    if (on) {
      html.style.setProperty('--bb-squeeze', '1');
      return;
    }
    html.style.removeProperty('--bb-squeeze');
    if (!html.getAttribute('style')) html.removeAttribute('style');
  }

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
  // frameReady starts over and the panel's new 'ready' sets it again.
  //
  // data-bb-pinned is the panel's look, and follows the pin whether or not the panel is open or the
  // window wide. The squeeze is the page's, and only while open on a reader page, so leaving a reader
  // page by client-side navigation puts the page back. keepPlace() is last because content.js calls
  // this straight after align() has moved the text again.
  function render() {
    if (!ready) return;
    const onReader = !!parseUrl();
    if (!tab) {
      if (!onReader) return;
      tab = buildTab();
    }
    if (!tab.isConnected) document.body.append(tab);
    if (onReader && state.panelOpen && !box) buildPanel();
    if (box && !box.isConnected) {
      frameReady = false;
      document.body.append(box);
    }
    tab.hidden = !onReader;
    tab.setAttribute('aria-expanded', String(state.panelOpen));
    if (box) {
      box.hidden = !onReader || !state.panelOpen;
      box.toggleAttribute('data-bb-pinned', state.panelPinned);
    }
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
  // about to disappear. In that case the top document's activeElement is the iframe element itself.
  //
  // Nothing moves focus into the panel on the way in. An open restored at page load must not take focus
  // from the reader, and Alt+P / A / S only reach content.js while focus is on the page.
  function setOpen(open) {
    if (!ready || !parseUrl()) return;
    if (!open && frame && document.activeElement === frame) tab.focus({ preventScroll: true });
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
  if (store) {
    store.get(DEFAULTS, (stored) => {
      state = { ...DEFAULTS, ...stored };
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

  // R4 on the way out. A page being thrown away takes the property with it anyway, but one going into
  // the back/forward cache would keep it, so it is taken off here. If the page comes back from that
  // cache with the panel still open and pinned, the ordinary route puts it back, without animating,
  // for the same reason as at load.
  window.addEventListener('pagehide', () => setSqueeze(false));
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    render();
    settle();
  });

  // open is what T-014's Save & open panel button tests for, so defining it is what turns that on.
  BB.panel = { open, close, toggle, refresh: render };
})();
