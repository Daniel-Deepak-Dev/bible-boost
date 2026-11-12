/*
 * BibleBoost — the panel's theme, before its first paint
 * panel-host.js puts bible.com's theme on the frame's address as #theme=dark or #theme=light, and this
 * puts the matching class on <html> while the body has not been parsed yet, so the panel never shows
 * one palette and then flips to the other (T-020 R4). The postMessage relay in panel.js carries every
 * change after this, and it is also what catches a frame whose address says nothing.
 *
 * Its own file, and a classic script in <head>, for two reasons. An extension page's CSP refuses an
 * inline script outright, and a module script is deferred: it runs after parsing, and Chrome may
 * already have painted by then. A classic script without defer blocks the parser right here, which is
 * the point.
 *
 * Only the two values theme.css matches are accepted. The page can frame its own copy of panel.html
 * with any hash it likes (B-012), so whatever is here is treated as display and nothing more.
 */
(() => {
  const theme = new URLSearchParams(location.hash.slice(1)).get('theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.classList.add(theme);
})();
