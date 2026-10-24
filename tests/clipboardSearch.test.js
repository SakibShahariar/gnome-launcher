// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {searchClipboardEntries} from '../lib/clipboardSearch.js';

const entries = [
    {name: 'Meeting notes', kind: 'text'},
    {name: 'Screenshot', kind: 'image', mimeType: 'image/png'},
];

test('filters clipboard text case-insensitively and preserves entry data', () => {
    assert.deepEqual(searchClipboardEntries(entries, 'MEETING'), [
        {...entries[0], kind: 'clipboard'},
    ]);
    assert.deepEqual(searchClipboardEntries(entries, 'shot'), [
        {...entries[1], kind: 'clipboard-image'},
    ]);
});

test('empty query returns all normalized entries and disabled history returns none', () => {
    assert.equal(searchClipboardEntries(entries).length, 2);
    assert.deepEqual(searchClipboardEntries(entries, '', false), []);
    assert.deepEqual(searchClipboardEntries(entries, 'meeting', false), []);
});

test('ignores malformed history containers and entries safely', () => {
    assert.deepEqual(searchClipboardEntries(null), []);
    assert.deepEqual(searchClipboardEntries({name: 'not an array'}), []);
    assert.deepEqual(searchClipboardEntries([
        null,
        undefined,
        'plain text',
        {name: 42, kind: 'text'},
        {name: 'Meeting notes', kind: 'text'},
    ], 'meeting'), [
        {name: 'Meeting notes', kind: 'clipboard'},
    ]);
    assert.deepEqual(searchClipboardEntries([
        {name: 42, kind: 'text'},
        {kind: 'image'},
    ]), [
        {kind: 'clipboard-image'},
    ]);
});
