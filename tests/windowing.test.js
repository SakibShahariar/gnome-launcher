// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {windowStart} from '../lib/layouts/windowing.js';

test('empty results always reset the visible window to zero', () => {
    assert.equal(windowStart(8, 0, 0, 8), 0);
});

test('list window stays put while the selected result remains visible', () => {
    assert.equal(windowStart(0, 6, 30, 8), 0);
    assert.equal(windowStart(5, 7, 30, 8), 5);
});

test('list window advances just enough to reveal the selected result', () => {
    assert.equal(windowStart(0, 8, 30, 8), 1);
    assert.equal(windowStart(4, 12, 30, 8), 5);
});

test('list window moves upward and clamps at the final page', () => {
    assert.equal(windowStart(8, 4, 30, 8), 4);
    assert.equal(windowStart(12, 29, 30, 8), 22);
});

test('grid window stays aligned to complete rows', () => {
    assert.equal(windowStart(0, 7, 40, 16, 4), 0);
    assert.equal(windowStart(0, 16, 40, 16, 4), 4);
});

test('grid window moves upward by rows and includes a partial final row', () => {
    assert.equal(windowStart(12, 4, 40, 16, 4), 4);
    assert.equal(windowStart(0, 17, 18, 16, 4), 4);
});

test('grid window clamps to the last valid row-aligned page', () => {
    assert.equal(windowStart(24, 36, 37, 16, 4), 24);
});
test('grid window still exposes a selected row when window is smaller than a row', () => {
    assert.equal(windowStart(0, 3, 12, 2, 4), 0);
    assert.equal(windowStart(0, 7, 12, 2, 4), 4);
    assert.equal(windowStart(8, 3, 12, 2, 4), 0);
});
