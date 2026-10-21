// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {fuzzyScore, fuzzySearch} from '../lib/fuzzySearch.js';

const app = name => ({get_name: () => name});

test('fuzzyScore is case-insensitive and gives prefixes the best score', () => {
    assert.equal(fuzzyScore('fire', 'Firefox'), 0);
    assert.equal(fuzzyScore('FIRE', 'firefox'), 0);
});

test('fuzzyScore ranks substrings before loose subsequence matches', () => {
    assert.equal(fuzzyScore('fox', 'Firefox'), 5);
    assert.equal(fuzzyScore('ffx', 'Firefox'), 1006);
});

test('fuzzyScore rejects missing characters and accepts an empty query', () => {
    assert.equal(fuzzyScore('xyz', 'Firefox'), null);
    assert.equal(fuzzyScore('', 'Firefox'), 0);
});

test('fuzzySearch filters non-matches and ranks prefix matches first', () => {
    const results = fuzzySearch([app('Terminal'), app('Firefox'), app('Files'), app('Foxit')], 'fi');
    assert.deepEqual(results.map(item => item.get_name()), ['Files', 'Firefox']);
});

test('fuzzySearch uses alphabetical order to break equal-score ties', () => {
    const results = fuzzySearch([app('Figma'), app('Files'), app('Firefox')], 'fi');
    assert.deepEqual(results.map(item => item.get_name()), ['Files', 'Figma', 'Firefox']);
});
