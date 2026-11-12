/*
 * BibleBoost — the side panel's page
 * The frame panel-host.js opens on bible.com (T-017): its pin (T-018), the page's theme (T-020) and the
 * note list (T-021).
 *
 * This page cannot see bible.com. Anything page-shaped comes from src/content/panel-host.js by
 * postMessage, and the table of those messages is in work/understandings/extension/03-messaging.md.
 * Notes never go that way: the list asks the service worker itself, through src/ui/app/store.js.
 */
import { createList } from './app/list.js';

// The one page this can be framed in that means anything. Only www, because that is the only host the
// content script matches.
const HOST_ORIGIN = 'https://www.bible.com';

// Narrows the sender down, and does not prove who it is. panel-host.js runs inside bible.com's tab, so
// its messages carry bible.com's origin, which is exactly what the page's own scripts carry too, and
// nothing here can tell those two apart. That is why nothing arriving this way may ever cause a write.
//
// What this does rule out is every other site, by origin, and any frame embedded in the page, by
// source: such a frame can be served from bible.com too, so it can pass the origin test on its own.
// The origin is compared whole, because a substring test would accept www.bible.com.evil.test.
function isFromHost(event) {
  return event.origin === HOST_ORIGIN && event.source === window.parent;
}

const pin = document.getElementById('bb-pin');

// Open is written where DevTools can read it, because this shell shows nothing else yet, and that is
// how the round trip through the host gets checked.
//
// pinned is the stored choice, and canPin is whether the window is wide enough to act on it. The host
// has to say the second, because a media query in here measures this frame, which is 30% of a wide
// window and so reads as narrow there too. A pin the window cannot honour is still shown as pressed
// whenever the window is wide again, because the choice was kept.
//
// The name stays the same whichever way the pin is, and aria-pressed is what says which way that is.
// Only the tooltip says what a click will do. None of this is a write, so it is fit to come from this
// channel: a page script posting its own state can only change what the button shows.
const HANDLERS = {
  state(msg) {
    document.documentElement.dataset.bbOpen = String(!!msg.open);
    const pinned = !!msg.pinned;
    pin.setAttribute('aria-pressed', String(pinned));
    pin.title = pinned ? 'Pinned beside the page. Click to float over it' : 'Pin beside the page';
    pin.hidden = !msg.canPin;
  },

  // bible.com's light or dark, from panel-host.js (T-020). The same class the page itself uses, on this
  // document's <html>, because theme.css matches html.light and html.dark and nothing else: a data-theme
  // attribute would leave the panel following the OS. Only the two known values, and the other one
  // comes off, so a page script posting nonsense can at worst pick one of the two palettes.
  theme(msg) {
    if (msg.theme !== 'light' && msg.theme !== 'dark') return;
    const root = document.documentElement;
    root.classList.remove(msg.theme === 'dark' ? 'light' : 'dark');
    root.classList.add(msg.theme);
  },
};

// Own-property only, so that { bb: 'constructor' } finds nothing.
window.addEventListener('message', (e) => {
  if (!isFromHost(e)) return;
  const type = e.data?.bb;
  if (typeof type === 'string' && Object.hasOwn(HANDLERS, type)) HANDLERS[type](e.data);
});

// Whatever goes up this channel also reaches bible.com's own scripts, because a message posted to the
// top window is delivered to every listener on it. So no note text ever goes this way.
const send = (msg) => window.parent.postMessage(msg, HOST_ORIGIN);

document.getElementById('bb-close').addEventListener('click', () => send({ bb: 'close' }));

// The button is not flipped here. The host answers every pin it accepts with a state message, and that
// is the only thing that changes the button, so it cannot show a pin the host refused or never got.
pin.addEventListener('click', () => {
  send({ bb: 'pin', pinned: pin.getAttribute('aria-pressed') !== 'true' });
});

// After the listener above, so that it already exists when the host answers, and before the list, so
// that nothing the list does can keep the × and the pin from working.
send({ bb: 'ready' });

// The list fills <main>. onOpen is left at its default, which does nothing, until T-022 expands a row
// into its editor in place.
//
// The handle on globalThis is for the console, as save-popover.js keeps BB.savePopover.debug: in the
// panel's own frame (right-click inside it, Inspect), bbPanel.list.stats says how many rows the DOM
// holds, and bbPanel.list.setFilter({ tag: 'x' }) shows the filtered empty state before T-023 gives the
// panel a filter of its own. Nothing outside this frame can reach it: the page that frames the panel is
// another origin.
const list = createList(document.querySelector('main'));
globalThis.bbPanel = { list };
