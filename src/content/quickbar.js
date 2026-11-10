/*
 * BibleBoost — the save chip and Alt+N
 * The second way to save a verse, for the day bible.com's menu changes and the row in it stops
 * appearing. menu.js rests on the shape of a menu somebody else renders. This rests on data-usfm and
 * nothing else of bible.com's, and it opens the same popover. It is also the quicker way to save a run
 * of verses, so it is not only a spare.
 *
 * It has to work with menu.js gone (R6), so nothing here reads BB.menu, and the one thing the two share,
 * the icon, is copied rather than borrowed.
 *
 * Classic script, and the manifest runs it AFTER capture.js, which it reads as it loads. save-popover.js
 * is only reached at the moment of a press and through ?., so a popover that failed to load costs a hint
 * and nothing else. content.js reaches this file the same way, because it runs first.
 */
var BB = (typeof BB !== 'undefined') ? BB : {};

(() => {
  const { VERSE_SEL, VID_RE, parseUrl, columnEls, usfmOf } = BB.dom;
  const { getSelection, onChange } = BB.capture;

  const LABEL = 'Save to BibleBoost';
  const SHORT_LABEL = 'Save';
  const NOTHING_SELECTED = 'Select a verse first, then press Alt+N';

  // menu.js's bookmark with a plus in it, so that the two ways of saving read as the same action. A copy
  // because R6 is a test of this file with that one removed.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ICON_PATH = 'M6 3.75h12v16.5l-6-4-6 4zM12 7.25v5.5M9.25 10h5.5';

  const GAP = 6;        // between the verse and the chip
  const GUTTER = 8;     // the closest the chip comes to the edge of the window
  const HINT_MS = 2500; // long enough to read one short sentence

  // save-popover.js's own root. open() returns nothing, so finding this is how a press learns whether a
  // popover really appeared.
  const POPOVER_ID = 'bb-save-pop';

  let chip = null;     // built on the first selection, then kept and hidden. See buildChip
  let verses = [];     // every element of the selected verses, in the one column they were chosen in
  let frame = null;    // the requestAnimationFrame that will next call place, if one is waiting
  let watching = false;
  let hint = null;
  let hintTimer = null;

  // ---------- Which verses ----------
  // A tap only works in the primary column, on either side of the page (06-verse-action-menu.md), and the
  // URL's id is what says which column that is. A text drag can be in either, and only the range knows.
  // One that reaches across both takes the first, which still gives the chip a verse to sit beside.
  //
  // window.getSelection and not the bare name: inside this function's scope, getSelection is capture's.
  function selectedColumn(selection) {
    const cols = columnEls();
    if (selection.source !== 'text') {
      const id = parseUrl()?.id;
      return cols.find((c) => c.getAttribute('class').match(VID_RE)?.[1] === id);
    }
    const sel = window.getSelection();
    return sel.rangeCount ? cols.find((c) => sel.getRangeAt(0).intersectsNode(c)) : undefined;
  }

  // Every element and not only the first, because a verse can be several: in NKJV each line of Psalm 23:1
  // is its own element, and a chip placed from the first would land on the second. usfmOf and not a
  // [data-usfm="..."] selector, for CEV's combined "ROM.1.3+ROM.1.4".
  function selectedEls(col, usfms) {
    const wanted = new Set(usfms);
    return [...col.querySelectorAll(VERSE_SEL)].filter((el) => wanted.has(usfmOf(el)));
  }

  // ---------- Where it goes ----------
  // The one box around everything selected, as { top, bottom, right }, or null when none of it is on
  // screen. Per line, through getClientRects, because a verse often starts part way along a line. Empty
  // rects are dropped, since the whitespace-only fragment after most verses can produce one, and an
  // element that has been disconnected by a chapter change produces none at all, so a chapter change
  // answers null here even before capture.js has reported the selection gone (R7).
  function selectionBox() {
    const rects = verses.flatMap((el) => [...el.getClientRects()]).filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) return null;
    const box = {
      top: Math.min(...rects.map((r) => r.top)),
      bottom: Math.max(...rects.map((r) => r.bottom)),
      right: Math.max(...rects.map((r) => r.right)),
    };
    return box.bottom > 0 && box.top < window.innerHeight ? box : null;
  }

  // box -> the chip's top, in viewport pixels, or null when no place avoids the verse.
  //
  // box is { top, bottom }, the selection. height is the chip's. ceiling and floor are the highest and
  // lowest the chip's edges may go. box can reach past either limit when part of it is scrolled away.
  //
  // Above first, because bible.com's menu card comes up from the bottom: on Exodus 13:3 at 1024px it
  // overlapped the lower part of the verse while the line above was clear. The cost is covering the end
  // of the previous verse's last line for as long as the selection is up.
  //
  // null and not a clamp. A selection taller than the window has no free side, and clamping would put the
  // chip on the verse, the one thing R5 rules out. The menu row and Alt+N still work then, and scrolling
  // brings an edge of the selection back for the chip to sit at.
  //
  // Each side is tested against both limits. A verse whose first line has only just come in under the tab
  // bar has an "above" that is still below the floor, and one nearly scrolled off the top has a "below"
  // still over the ceiling.
  //
  // Pure, so that the promise this function makes, never on top of the verse, can be tested from Node.
  function chipTop(box, height, { ceiling, floor }) {
    const fits = (top) => top >= ceiling && top + height <= floor;
    const above = box.top - GAP - height;
    if (fits(above)) return above;
    const below = box.bottom + GAP;
    return fits(below) ? below : null;
  }

  // Everything here is read and then written once. hidden has to come off first because a hidden element
  // has no size, and neither it nor the inline style is observed, since the observer in content.js
  // watches only class and the tree (04-observer-hazards.md).
  //
  // The floor comes from scroll-margin-bottom, which content.css sets to the height of bible.com's bottom
  // bars and which does nothing to a fixed element. Reading --tabbar-h directly does not work: below
  // 1010px it is declared as calc(72px + env(safe-area-inset-bottom,0px)), a custom property's computed
  // value is that text with the arithmetic left undone, and parseFloat of it is NaN. A real length
  // property makes the browser do the sum (R8).
  //
  // right rather than left, so the label sliding out on hover grows away from the edge it is pinned to.
  // clientWidth and not innerWidth, which counts a scrollbar that a fixed element does not sit under.
  function place() {
    frame = null;
    if (!chip) return;
    chip.hidden = false;
    const box = selectionBox();
    const { offsetHeight: height, offsetWidth: width } = chip;
    const bars = parseFloat(getComputedStyle(chip).scrollMarginBottom) || 0;
    const top = box ? chipTop(box, height, { ceiling: GUTTER, floor: window.innerHeight - bars - GUTTER }) : null;
    if (top === null) {
      chip.hidden = true;
      return;
    }
    const view = document.documentElement.clientWidth;
    chip.style.top = `${top}px`;
    chip.style.right = `${Math.max(GUTTER, Math.min(view - box.right, view - width - GUTTER))}px`;
  }

  const queuePlace = () => { if (frame === null) frame = requestAnimationFrame(place); };

  // The column and not the verses, because a ResizeObserver reports nothing for an inline element. It is
  // here for what moves the text with no scroll: bible.com's Aa size, or Align being switched.
  const columnResize = new ResizeObserver(queuePlace);

  // Capture, because a scroll event does not bubble, and that way it does not matter what scrolls. All of
  // it exists only while something is selected, so a page where nobody is saving anything pays nothing.
  function watch(col) {
    columnResize.disconnect();
    if (col) columnResize.observe(col);
    if (!!col === watching) return;
    watching = !!col;
    const change = watching ? 'addEventListener' : 'removeEventListener';
    window[change]('scroll', queuePlace, { capture: true, passive: true });
    window[change]('resize', queuePlace);
  }

  // ---------- Following the selection ----------
  // While the popover is open, a selection reading as null means nothing. A text selection collapses the
  // moment the dialog takes focus, and hiding the chip then would leave save-popover.js nothing visible
  // to hand focus back to. keepAcrossPopover catches up once it has closed.
  function follow(selection) {
    if (!selection && document.getElementById(POPOVER_ID)) return;
    const col = selection ? selectedColumn(selection) : undefined;
    verses = col ? selectedEls(col, selection.usfms) : [];
    if (!verses.length) {
      if (chip) chip.hidden = true;
      watch(null);
      return;
    }
    chip ??= buildChip();
    if (!chip.isConnected) document.body.append(chip);
    watch(col);
    place();
  }

  // ---------- Saving ----------
  // A text selection does not survive the popover. Measured on 2026-11-10 on Exodus 13, showModal alone
  // collapsed a range over NKJV's verse 4, and closing the dialog did not bring it back. A tap selection
  // is a class on the verse and is not affected, so only a text selection has anything to put back
  // (T-014 R8: cancelling leaves the verse selected).
  function textRange(selection) {
    if (selection?.source !== 'text') return null;
    const sel = window.getSelection();
    return sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  }

  // Runs on the dialog's close event, which does arrive even though save-popover.js has already removed
  // the element by then. It can be late, 650 ms in a background pane, which costs only a slow reappearance.
  // The fresh read is there because bible.com can navigate underneath the dialog (T-014).
  function keepAcrossPopover(dialog, range) {
    dialog.addEventListener('close', () => {
      if (range) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      follow(getSelection());
    }, { once: true });
  }

  // trigger is the chip, or nothing for Alt+N, which has nothing to anchor to or give focus back to.
  //
  // The range has to be taken before open(), which is what collapses it.
  //
  // One outcome for every way of not getting a popover, whether nothing is selected, the popover could
  // not read the page, or its script never loaded. A shortcut that appears broken is worse than one that
  // explains itself (R4).
  function save(trigger = null) {
    const selection = getSelection();
    const range = textRange(selection);
    if (selection) BB.savePopover?.open(trigger);
    const dialog = document.getElementById(POPOVER_ID);
    if (dialog) keepAcrossPopover(dialog, range);
    else showHint();
  }

  // ---------- The hint ----------
  // Appended and then filled, in that order, because a screen reader announces a change inside a live
  // region and may say nothing about one that arrives already holding its text.
  function showHint() {
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'bb-hint';
      hint.setAttribute('data-bb-own', '');
      hint.setAttribute('role', 'status');
      hint.setAttribute('aria-live', 'polite');
    }
    if (!hint.isConnected) document.body.append(hint);
    hint.hidden = false;
    hint.textContent = NOTHING_SELECTED;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      hint.hidden = true;
      hint.textContent = '';
    }, HINT_MS);
  }

  // ---------- Building the chip ----------
  // createElementNS and not createElement: an svg made by createElement is an unknown HTML element and
  // draws nothing. The path is a literal, so no markup is ever parsed.
  function buildIcon() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICON_PATH);
    svg.append(path);
    return svg;
  }

  // Built on the first selection and not at load, for the reason in menu.js: bible.com has finished
  // hydrating by then, because its own tap handler has just run.
  //
  // Then it stays, with hidden going on and off. The T-004 guard would forgive adding and removing it,
  // but the observer only watches class and the tree, so toggling hidden produces no record to forgive.
  // Only the first appearance is ever seen.
  //
  // A real button, for Tab, Enter and Space, and hidden takes it out of the tab order while it has no
  // business being there. There is no mousedown guard, because a real press on a button left a text
  // selection whole, measured on 2026-11-10, and letting it take focus is what gives the popover a
  // trigger to return to.
  function buildChip() {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'bb-chip';
    button.title = `${LABEL} (Alt+N)`;
    button.setAttribute('data-bb-own', '');
    button.setAttribute('aria-label', LABEL);
    button.hidden = true;

    const label = document.createElement('span');
    label.textContent = SHORT_LABEL;

    button.append(buildIcon(), label);
    button.addEventListener('click', (e) => save(e.currentTarget));
    return button;
  }

  // ---------- Init ----------
  onChange(follow);

  BB.quickbar = {
    save,
    // For test/quickbar.test.js.
    debug: { chipTop },
  };
})();
