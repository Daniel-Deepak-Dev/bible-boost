/*
 * src/content/quickbar.js — where the save chip goes, and the promise that it is never on the verse.
 *
 * Only chipTop is covered, because it is the one part with no page in it. A live page shows the chip in
 * the handful of positions somebody happened to try, and this walks every combination of them. Showing
 * and hiding the chip is DOM, and stays a manual check (test/README.md).
 *
 * quickbar.js is a classic script, so it is run through node:vm, with BB.dom and BB.capture standing in
 * for the page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('../src/content/quickbar.js', import.meta.url), 'utf8');

function load() {
  const BB = {
    dom: { VERSE_SEL: '', VID_RE: /x/, parseUrl: () => null, columnEls: () => [], usfmOf: () => '' },
    capture: { getSelection: () => null, onChange: () => () => {} },
  };
  const context = vm.createContext({ BB, ResizeObserver: class { observe() {} disconnect() {} } });
  vm.runInContext(SOURCE, context);
  return context.BB.quickbar.debug.chipTop;
}

const chipTop = load();
const HEIGHT = 30;
const LIMITS = { ceiling: 8, floor: 720 }; // an 800px window with a 72px tab bar, as at phone width

const overlaps = (top, box) => top < box.bottom && top + HEIGHT > box.top;

test('it goes above the verse when there is room', () => {
  const top = chipTop({ top: 300, bottom: 400 }, HEIGHT, LIMITS);
  assert.ok(top + HEIGHT <= 300);
});

test('it goes below a verse at the top of the window', () => {
  const top = chipTop({ top: 10, bottom: 100 }, HEIGHT, LIMITS);
  assert.ok(top >= 100);
});

test('it goes below a verse whose start has scrolled away', () => {
  const top = chipTop({ top: -200, bottom: 100 }, HEIGHT, LIMITS);
  assert.ok(top >= 100);
});

test('a selection taller than the window gets no chip rather than one on top of it', () => {
  assert.equal(chipTop({ top: -50, bottom: 900 }, HEIGHT, LIMITS), null);
});

test('a verse that has only just come in under the tab bar gets no chip on the tab bar', () => {
  assert.equal(chipTop({ top: 790, bottom: 900 }, HEIGHT, LIMITS), null);
});

test('a verse nearly scrolled off the top gets no chip above the ceiling', () => {
  assert.equal(chipTop({ top: -100, bottom: 1 }, HEIGHT, LIMITS), null);
});

// The two limits are drawn from the tab-bar case above, and every box from far off one edge of the window
// to far off the other, in 7px steps so that the edges are met from both sides.
test('wherever the verse is, the chip is clear of it and inside the limits', () => {
  let placed = 0;
  for (let top = -300; top <= 1000; top += 7) {
    for (let size = 20; size <= 900; size += 7) {
      const box = { top, bottom: top + size };
      const result = chipTop(box, HEIGHT, LIMITS);
      if (result === null) continue;
      placed += 1;
      assert.ok(!overlaps(result, box), `on the verse: ${JSON.stringify(box)} -> ${result}`);
      assert.ok(result >= LIMITS.ceiling, `above the ceiling: ${JSON.stringify(box)} -> ${result}`);
      assert.ok(result + HEIGHT <= LIMITS.floor, `below the floor: ${JSON.stringify(box)} -> ${result}`);
    }
  }
  assert.ok(placed > 1000, `only ${placed} boxes were given a place, so this proved little`);
});
