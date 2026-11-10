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
 * it was open, and carries messages. What pinning does to the page is T-018's, and the width is T-019's.
 *
 * Classic script, and the manifest runs it AFTER bible-dom.js, which it reads as it loads. content.js
 * runs before this file and reaches it through BB.panel?. at the moment of each refresh.
 */
var BB = (typeof BB !== 'undefined') ? BB : {};

(() => {
  const { parseUrl } = BB.dom;

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

  const announce = () => send({ bb: 'state', open: state.panelOpen });

  // Own-property only, so that { bb: 'constructor' } finds nothing, the same care the worker's router
  // takes with msg.type.
  const HANDLERS = {
    ready() { frameReady = true; announce(); },
    close() { setOpen(false); },
    pin(msg) { if (typeof msg.pinned === 'boolean') persist({ panelPinned: msg.pinned }); },
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
    if (box) box.hidden = !onReader || !state.panelOpen;
  }

  // ---------- Opening and closing ----------
  // Focus is only moved when it would otherwise be lost, which is when it was inside the frame that is
  // about to disappear. In that case the top document's activeElement is the iframe element itself.
  //
  // Nothing moves focus into the panel on the way in. An open restored at page load must not take focus
  // from the reader, and Alt+P / A / S only reach content.js while focus is on the page.
  function setOpen(open) {
    if (!ready || !parseUrl()) return;
    if (!open && frame && document.activeElement === frame) tab.focus({ preventScroll: true });
    persist({ panelOpen: open });
    render();
    announce();
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
    });
  } else {
    render();
  }

  // open is what T-014's Save & open panel button tests for, so defining it is what turns that on.
  BB.panel = { open, close, toggle, refresh: render };
})();
