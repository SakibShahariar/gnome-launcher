// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {parseFinderPrefix} from '../lib/finderPrefix.js';

test('parses run, files, and clipboard prefixes', () => {
    assert.deepEqual(parseFinderPrefix('> top'), {mode: 'run', query: 'top'});
    assert.deepEqual(parseFinderPrefix('/ report'), {mode: 'files', query: 'report'});
    assert.deepEqual(parseFinderPrefix('; copied text'), {mode: 'clipboard', query: 'copied text'});
    assert.deepEqual(parseFinderPrefix('= 2 + 2'), {mode: 'calculator', query: '2 + 2'});
    assert.deepEqual(parseFinderPrefix('recent report'), {mode: 'recent', query: 'report'});
    assert.deepEqual(parseFinderPrefix('RECENT report'), {mode: 'recent', query: 'report'});
});

test('parses the window prefix case-insensitively', () => {
    assert.deepEqual(parseFinderPrefix('w firefox'), {mode: 'window', query: 'firefox'});
    assert.deepEqual(parseFinderPrefix('W firefox'), {mode: 'window', query: 'firefox'});
});

test('allows a prefix with an empty query', () => {
    assert.deepEqual(parseFinderPrefix('>'), {mode: 'run', query: ''});
    assert.deepEqual(parseFinderPrefix('/'), {mode: 'files', query: ''});
    assert.deepEqual(parseFinderPrefix(';'), {mode: 'clipboard', query: ''});
    assert.deepEqual(parseFinderPrefix('='), {mode: 'calculator', query: ''});
    assert.deepEqual(parseFinderPrefix('recent'), {mode: 'recent', query: ''});
    assert.deepEqual(parseFinderPrefix('w '), {mode: 'window', query: ''});
});

test('does not parse ordinary text or non-string input as a prefix', () => {
    assert.equal(parseFinderPrefix('firefox'), null);
    assert.equal(parseFinderPrefix('window manager'), null);
    assert.equal(parseFinderPrefix(null), null);
    assert.equal(parseFinderPrefix(42), null);
});
