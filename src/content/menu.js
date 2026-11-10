/*
 * BibleBoost — the save row in bible.com's verse menu
 * Puts one "Save to BibleBoost" row between Highlight and Copy, and keeps it there. What the row does
 * when pressed belongs to T-014. This file only makes sure the row exists.
 * What bible.com's menu is made of is written down in
 * work/understandings/bible-com/06-verse-action-menu.md, which is the first place to look when this
 * stops working. Everything here that depends on that shape is in isActionRow and findList.
 *
 * It holds no reference to the row, on purpose: the DOM is the only record of whether the row exists.
 * The menu stays mounted when it closes, so the row is normally still there, and client-side chapter
 * navigation replaces the entire menu, so the row is then gone along with its one listener. Asking
 * the list every time covers both, and leaves nothing behind to clean up (R10).
 *
 * Classic script, and the manifest runs it AFTER capture.js, which it reads as it loads.
 */
var BB = (typeof BB !== 'undefined') ? BB : {};

(() => {
  const { columnEls } = BB.dom;
  const { menuLinks, onChange } = BB.capture;

  // minRows is how many rows a block needs before it counts as the action list. bible.com shows four,
  // and the blocks beside them have at most one: the header has its reference link, and the logged-out
  // sign-up prompt has an image and a button.
  //
  // insertAt is the place this row takes among bible.com's own rows, and 1 means straight after the
  // first one, Highlight (R1). It is a position and not a search for the word "Copy" because the
  // interface can be in any language: under /ar/ every label in this list is in Arabic (R2).
  //
  // One object rather than two constants so that the console can break them on purpose, through
  // BB.menu.debug. The acceptance check for a failed anchor needs some way to cause one.
  const LAYOUT = { minRows: 3, insertAt: 1 };

  // ---------- Finding the action list ----------
  // A row is a child holding an icon and a label, so an svg and a p. Structure, because the classes on
  // these rows are styling that can change with any build, and the words in them are localized.
  //
  // Our own row is refused by its marker so that it can never count towards minRows or shift the
  // index that insertAt is measured in.
  function isActionRow(el) {
    return !el.hasAttribute('data-bb-own') && !!el.querySelector('svg') && !!el.querySelector('p');
  }

  const actionRows = (el) => [...el.children].filter(isActionRow);

  // Starts at the menu's header link, the one part of the menu that capture.js already has to be able
  // to recognise, and climbs looking sideways at each level for a block made of rows. The list turned
  // out to be a sibling of the header's row, three levels up, at 1024px, at 375px and under /ar/.
  //
  // The climb stops before any ancestor that contains a reader column. Above that point is the reader
  // itself, and a list-shaped thing found there would not be this menu's. Getting nothing is a better
  // outcome than getting the wrong element and inserting into it.
  //
  // Returns null with nothing selected, because the link only names verses during a selection. That
  // is fine, since this only runs once there is a selection to serve.
  function findList() {
    const cols = columnEls();
    for (const { a } of menuLinks()) {
      for (let n = a; n.parentElement && !cols.some((c) => n.parentElement.contains(c)); n = n.parentElement) {
        const list = [...n.parentElement.children].find((c) => c !== n && actionRows(c).length >= LAYOUT.minRows);
        if (list) return list;
      }
    }
    return null;
  }

  // ---------- Building the row ----------
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const LABEL = 'Save to BibleBoost';

  // A bookmark with a plus in it. Symmetric, so unlike the arrows beside it, it needs no mirroring in a
  // right-to-left interface.
  const ICON_PATH = 'M6 3.75h12v16.5l-6-4-6 4zM12 7.25v5.5M9.25 10h5.5';

  // createElementNS and not createElement: an svg made by createElement is an unknown HTML element and
  // draws nothing. The path is a literal, so no markup is ever parsed (R7).
  function buildIcon() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICON_PATH);
    svg.append(path);
    return svg;
  }

  // T-014 replaces this with the save popover. Until then it logs, which is also how the keyboard
  // acceptance check observes that Enter and Space work.
  //
  // No stopPropagation: nothing from the list upward has a React handler, and a real click on a test
  // button in this list left the selection and the menu exactly as they were.
  function onActivate() {
    console.debug('[BibleBoost] menu: save row activated', BB.capture.getSelection());
  }

  // A real button, for what that gives away for free: Tab reaches it, and Enter and Space both click
  // it (R9). bible.com's own rows are divs and cannot do any of that. It cannot become a hidden Tab
  // stop while the menu is parked off-screen, because bible.com makes the menu root inert until it opens.
  //
  // data-bb-own goes on this root only. The T-004 guard walks up with closest(), so the icon and label
  // inherit it (R5). A span for the label because a p inside a button is invalid HTML, which also
  // keeps this row from looking like one of bible.com's to isActionRow.
  //
  // The flex direction is copied from a neighbour instead of read from html[dir]. Under /ar/ the page
  // is dir="rtl", yet this menu sits in the wrapper of the primary version and computes direction: ltr,
  // and bible.com flips its rows with flex-direction: row-reverse. Copying the answer gets it right
  // without having to know how they arrived at it. Once per insertion is enough, because anything that
  // could change it is a navigation, and a navigation replaces the menu. Inline style is not observed.
  function buildRow(neighbour) {
    const row = document.createElement('button');
    row.type = 'button';
    row.id = 'bb-save-row';
    row.setAttribute('data-bb-own', '');
    row.style.flexDirection = getComputedStyle(neighbour).flexDirection;

    const label = document.createElement('span');
    label.textContent = LABEL;

    row.append(buildIcon(), label);
    row.addEventListener('click', onActivate);
    return row;
  }

  // ---------- Keeping it inserted ----------
  // The check comes first and is asked of this list, not of the page (R4). On a second selection the
  // row is normally still here, because the menu only moves off-screen when it closes. After a chapter
  // change this is a new list with no row in it, and the old row has gone with the old menu.
  //
  // rows leaves our own row out, so insertAt keeps meaning a place among bible.com's rows.
  //
  // There is no separate branch for a missing anchor because insertBefore already is one: with null as
  // its second argument it appends, so a menu that has lost its second row still gets the save row, at
  // the end (R3). bible.com's rows are only ever read here, and none of them is moved (R8).
  function placeRow(list) {
    if (list.querySelector(':scope > [data-bb-own]')) return;
    const rows = actionRows(list);
    list.insertBefore(buildRow(rows[0]), rows[LAYOUT.insertAt] ?? null);
  }

  // Reported only when the state changes, like reportSource in capture.js. This runs on every selection,
  // and one line saying the menu has moved is useful where a line per tap is not (R3).
  let lost = false;
  function reportLost(isLost) {
    if (isLost === lost) return;
    lost = isLost;
    console.debug('[BibleBoost] menu:', isLost ? 'action list not found' : 'action list found again');
  }

  // Runs on every change of selection, which is what makes this "keeping it inserted": capture.js
  // already notices those, so no observer is needed here. The list's own children never changed across
  // selecting, closing and reopening, and a navigation is the only thing seen to take the row away. If
  // something else ever does, the next selection puts it back.
  //
  // Nothing to do on null, the closing case. The row stays where it is for the next selection.
  //
  // A text selection is skipped because a drag does not raise the menu, and the header link names no
  // verses without it, so reporting the list as lost would be a false alarm on every drag.
  //
  // Injecting only from here, and never at load, also means bible.com has finished hydrating, since
  // its own tap handler has just run. A foreign node present during hydration is a mismatch for React.
  //
  // The try is here rather than left to the isolation in capture.js because that logs console.error,
  // and a redesign of someone else's menu is expected and is not an error in this extension (R3).
  function ensureRow(selection) {
    if (!selection || selection.source === 'text') return;
    try {
      const list = findList();
      reportLost(!list);
      if (list) placeRow(list);
    } catch (err) {
      console.debug('[BibleBoost] menu: could not place the row', err);
    }
  }

  // ---------- Init ----------
  onChange(ensureRow);

  BB.menu = { debug: LAYOUT };
})();
