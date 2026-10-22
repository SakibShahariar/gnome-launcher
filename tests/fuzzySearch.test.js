// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {fuzzyScore, fuzzySearch} from '../lib/fuzzySearch.js';

const app = name => ({get_name: () => name, get_id: () => `${name}.desktop`});

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
    assert.deepEqual(results.map(item => item.get_name()), ['Files', 'Firefox', 'Foxit']);
});

test('fuzzySearch uses alphabetical order to break equal-score ties', () => {
    const results = fuzzySearch([app('Figma'), app('Files'), app('Firefox')], 'fi');
    assert.deepEqual(results.map(item => item.get_name()), ['Figma', 'Files', 'Firefox']);
});

test('rankAppsByUsage puts frequent apps first in usage order', async () => {
    const {rankAppsByUsage} = await import('../lib/fuzzySearch.js');
    const apps = [app('Terminal'), app('Firefox'), app('Files'), app('Calculator')];
    const mostUsed = [apps[1], apps[2]];
    assert.deepEqual(
        rankAppsByUsage(apps, mostUsed).map(item => item.get_name()),
        ['Firefox', 'Files', 'Calculator', 'Terminal']
    );
});

test('rankAppsByUsage sorts apps without usage data alphabetically', async () => {
    const {rankAppsByUsage} = await import('../lib/fuzzySearch.js');
    const apps = [app('Terminal'), app('Files'), app('Calculator')];
    assert.deepEqual(
        rankAppsByUsage(apps, []).map(item => item.get_name()),
        ['Calculator', 'Files', 'Terminal']
    );
});


test('resolveSearchResults excludes apps outside the launchable list', async () => {
    const {resolveSearchResults} = await import('../lib/fuzzySearch.js');
    const visible = app('Visible');
    const hidden = app('Hidden');
    const results = resolveSearchResults([visible], ['Hidden.desktop', 'Visible.desktop', 'missing.desktop']);
    assert.deepEqual(results, [visible]);
    assert.ok(!results.includes(hidden));
});

test('resolveSearchResults preserves native provider ranking', async () => {
    const {resolveSearchResults} = await import('../lib/fuzzySearch.js');
    const firefox = app('Firefox');
    const files = app('Files');
    const terminal = app('Terminal');
    assert.deepEqual(
        resolveSearchResults([files, terminal, firefox], ['Terminal.desktop', 'Firefox.desktop']),
        [terminal, firefox]
    );
});
