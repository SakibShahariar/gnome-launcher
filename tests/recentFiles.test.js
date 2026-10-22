// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {filterRecentFiles} from '../lib/recentFiles.js';

const items = [
    {name: 'Notes.txt', uri: 'file:///home/user/Notes.txt', modified: 10},
    {name: 'Report.pdf', uri: 'file:///home/user/Report.pdf', modified: 30},
    {name: 'Draft.md', uri: 'file:///home/user/Draft.md', modified: 20},
];

test('filters recent files by display name or URI and orders newest first', () => {
    assert.deepEqual(filterRecentFiles(items).map(item => item.name), ['Report.pdf', 'Draft.md', 'Notes.txt']);
    assert.deepEqual(filterRecentFiles(items, 'notes').map(item => item.name), ['Notes.txt']);
    assert.deepEqual(filterRecentFiles(items, '/home/user/draft').map(item => item.name), ['Draft.md']);
});

test('handles empty input, malformed items, and invalid limits', () => {
    assert.deepEqual(filterRecentFiles([]), []);
    assert.deepEqual(filterRecentFiles([{name: 'no URI'}]), []);
    assert.deepEqual(filterRecentFiles(items, '', 0), []);
    assert.deepEqual(filterRecentFiles(items, '', -1), []);
});

test('caps the result count', () => {
    const many = Array.from({length: 30}, (_, i) => ({
        name: `File ${i}`, uri: `file:///tmp/${i}`, modified: i,
    }));
    assert.equal(filterRecentFiles(many, '', 100).length, 20);
});
