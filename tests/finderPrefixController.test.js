// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {applyFinderPrefix, cancelAppSearch} from '../lib/finderPrefixController.js';

function mockLayout(initialText = '') {
    return {
        mode: 'apps',
        switched: [],
        entry: {
            text: initialText,
            get_text() { return this.text; },
            set_text(text) { this.text = text; },
        },
        _switchMode(mode) {
            this.switched.push(mode);
            this.mode = mode;
        },
    };
}

const modes = [['apps'], ['settings']];

test('switches to the prefixed mode and hands off only the query', () => {
    const layout = mockLayout('s network');
    assert.equal(applyFinderPrefix(layout, 's network', modes), true);
    assert.deepEqual(layout.switched, ['settings']);
    assert.equal(layout.entry.get_text(), 'network');
});

test('does not switch an already active mode unnecessarily', () => {
    const layout = mockLayout('settings displays');
    layout.mode = 'settings';
    assert.equal(applyFinderPrefix(layout, 'settings displays', modes), true);
    assert.deepEqual(layout.switched, []);
    assert.equal(layout.entry.get_text(), 'displays');
});

test('leaves unsupported prefixes and ordinary text untouched', () => {
    const layout = mockLayout('> echo hi');
    assert.equal(applyFinderPrefix(layout, '> echo hi', modes), false);
    assert.equal(layout.entry.get_text(), '> echo hi');
    assert.deepEqual(layout.switched, []);
    assert.equal(applyFinderPrefix(layout, 'ordinary text', modes), false);
});

test('cancels an outstanding app search when switching to a finder', () => {
    let cancelled = false;
    const search = {cancel() { cancelled = true; }};
    const dialog = {_searchCancellable: search};
    cancelAppSearch(dialog);
    assert.equal(cancelled, true);
    assert.equal(dialog._searchCancellable, null);
    cancelAppSearch(dialog);
    assert.equal(cancelled, true);
});
