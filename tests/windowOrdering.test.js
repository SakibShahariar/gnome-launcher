// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {sortWindows} from '../lib/windowOrdering.js';

const windowEntry = (name, focused = false) => ({
    name,
    window: {has_focus: () => focused},
});

test('keeps the focused window first and sorts the rest by title', () => {
    const entries = [
        windowEntry('Terminal'),
        windowEntry('browser'),
        windowEntry('Files', true),
        windowEntry('Calendar'),
    ];

    assert.deepEqual(sortWindows(entries), [entries[2], entries[1], entries[3], entries[0]]);
});

test('sorting is case-insensitive and stable for equal titles', () => {
    const first = windowEntry('Browser');
    const second = windowEntry('browser');
    const third = windowEntry('Calculator');

    assert.deepEqual(sortWindows([first, second, third]), [third, first, second]);
});

test('captures focus once per window and handles missing title/focus methods', () => {
    let focusReads = 0;
    const focused = {name: 'Focused', window: {has_focus: () => { focusReads++; return true; }}};
    const unnamed = {window: {}};

    assert.deepEqual(sortWindows([unnamed, focused]), [focused, unnamed]);
    assert.equal(focusReads, 1);
});

test('does not mutate the supplied window list', () => {
    const entries = [windowEntry('Zulu'), windowEntry('Alpha')];
    const original = [...entries];

    sortWindows(entries);

    assert.deepEqual(entries, original);
});
