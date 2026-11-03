// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {searchFinderResults} from '../lib/finderSearch.js';

const dependencies = {
    powerActions: [{id: 'lock', name: 'Lock Screen'}],
    searchFiles: async query => [{name: `${query}.txt`, path: `/${query}.txt`}],
    clipboardEntries: [{name: 'Copied text', text: 'hello', kind: 'text'}],
    clipboardEnabled: true,
    searchClipboardEntries: (entries, query, enabled) => enabled
        ? entries.filter(item => item.name.toLowerCase().includes(query.toLowerCase()))
            .map(item => ({...item, kind: item.kind === 'image' ? 'clipboard-image' : 'clipboard'}))
        : [],
    searchModeResults: (mode, query) => [{kind: mode, name: query}],
};

test('resolves the screen-color picker action without depending on optional portal availability', async () => {
    assert.deepEqual(await searchFinderResults('color', '', dependencies), [
        {kind: 'color', name: 'Pick a color from the screen'},
    ]);
});

test('resolves command and power finders', async () => {
    assert.deepEqual(await searchFinderResults('run', '  echo hi  ', dependencies), [
        {kind: 'run', command: 'echo hi', name: 'Run: echo hi'},
    ]);
    assert.deepEqual(await searchFinderResults('power', '', dependencies), [
        {id: 'lock', name: 'Lock Screen', kind: 'power'},
    ]);
    assert.deepEqual(await searchFinderResults('power', 'restart', {
        ...dependencies,
        powerActions: [...dependencies.powerActions, {id: 'restart', name: 'Restart'}],
    }), [{id: 'restart', name: 'Restart', kind: 'power'}]);
});

test('resolves files and clipboard finders', async () => {
    assert.deepEqual(await searchFinderResults('files', 'report', dependencies), [
        {name: 'report.txt', path: '/report.txt', kind: 'file'},
    ]);
    assert.equal((await searchFinderResults('clipboard', 'copied', dependencies))[0].kind, 'clipboard');
    assert.deepEqual(await searchFinderResults('clipboard', 'copied', {
        ...dependencies, clipboardEnabled: false,
    }), []);
});

test('delegates remaining finders and respects cancellation', async () => {
    assert.deepEqual(await searchFinderResults('emoji', 'smile', dependencies), [
        {kind: 'emoji', name: 'smile'},
    ]);
    assert.deepEqual(await searchFinderResults('files', 'report', dependencies, {
        is_cancelled: () => true,
    }), []);
});


test('keeps the selected result visible in a bounded finder window', async () => {
    const {getFinderResultWindow} = await import('../lib/finderSearch.js');
    assert.deepEqual(getFinderResultWindow(30, 0, 12), {start: 0, end: 12});
    assert.deepEqual(getFinderResultWindow(30, 12, 12), {start: 1, end: 13});
    assert.deepEqual(getFinderResultWindow(30, 29, 12), {start: 18, end: 30});
    assert.deepEqual(getFinderResultWindow(3, 2, 12), {start: 0, end: 3});
    assert.deepEqual(getFinderResultWindow(0, 0, 12), {start: 0, end: 0});
});
