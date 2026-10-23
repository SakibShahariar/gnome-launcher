// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {parseFinderPrefix, FINDERS} from '../lib/finderPrefix.js';

test('parses symbolic and word finder prefixes', () => {
    assert.deepEqual(parseFinderPrefix('> top'), {mode: 'run', query: 'top'});
    assert.deepEqual(parseFinderPrefix('/ report'), {mode: 'files', query: 'report'});
    assert.deepEqual(parseFinderPrefix('; copied text'), {mode: 'clipboard', query: 'copied text'});
    assert.deepEqual(parseFinderPrefix('= 2 + 2'), {mode: 'calculator', query: '2 + 2'});
    assert.deepEqual(parseFinderPrefix('? cats'), {mode: 'web', query: 'cats'});
    assert.deepEqual(parseFinderPrefix('recent report'), {mode: 'recent', query: 'report'});
    assert.deepEqual(parseFinderPrefix('emoji smile'), {mode: 'emoji', query: 'smile'});
    assert.deepEqual(parseFinderPrefix('RECENT report'), {mode: 'recent', query: 'report'});
    assert.deepEqual(parseFinderPrefix('w firefox'), {mode: 'window', query: 'firefox'});
    assert.deepEqual(parseFinderPrefix('W firefox'), {mode: 'window', query: 'firefox'});
    assert.deepEqual(parseFinderPrefix('s network'), {mode: 'settings', query: 'network'});
    assert.deepEqual(parseFinderPrefix('S network'), {mode: 'settings', query: 'network'});
    assert.deepEqual(parseFinderPrefix('settings Displays'), {mode: 'settings', query: 'Displays'});
});

test('allows registered prefixes with an empty query', () => {
    assert.deepEqual(parseFinderPrefix('>'), {mode: 'run', query: ''});
    assert.deepEqual(parseFinderPrefix('/'), {mode: 'files', query: ''});
    assert.deepEqual(parseFinderPrefix(';'), {mode: 'clipboard', query: ''});
    assert.deepEqual(parseFinderPrefix('='), {mode: 'calculator', query: ''});
    assert.deepEqual(parseFinderPrefix('?'), {mode: 'web', query: ''});
    assert.deepEqual(parseFinderPrefix('recent '), {mode: 'recent', query: ''});
    assert.deepEqual(parseFinderPrefix('emoji '), {mode: 'emoji', query: ''});
    assert.deepEqual(parseFinderPrefix('w '), {mode: 'window', query: ''});
    assert.deepEqual(parseFinderPrefix('s '), {mode: 'settings', query: ''});
    assert.deepEqual(parseFinderPrefix('settings '), {mode: 'settings', query: ''});
});

test('exposes finder metadata for layout and finder integration', () => {
    assert.equal(FINDERS.get('apps').default, true);
    assert.equal(FINDERS.get('apps').label, 'Applications');
    assert.equal(FINDERS.get('run').label, 'Run a command');
    assert.equal(FINDERS.get('settings').label, 'GNOME Settings');
    assert.equal(FINDERS.list().length, 10);
});

test('does not parse ordinary text or non-string input as a prefix', () => {
    assert.equal(parseFinderPrefix('firefox'), null);
    assert.equal(parseFinderPrefix('window manager'), null);
    assert.equal(parseFinderPrefix('recent'), null);
    assert.equal(parseFinderPrefix('emoji'), null);
    assert.equal(parseFinderPrefix('settings'), null);
    assert.equal(parseFinderPrefix(null), null);
    assert.equal(parseFinderPrefix(42), null);
});
