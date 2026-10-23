// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {searchModeResults} from '../lib/modeSearch.js';

const deps = {
    searchEmoji: query => [{emoji: '🙂', name: 'smile'}].filter(() => !query || query === 'smile'),
    searchRecentFiles: query => [{name: 'Report', uri: 'file:///report'}].filter(x => x.name.toLowerCase().includes(query.toLowerCase())),
    evaluateCalculatorInput: query => query === '2 + 2' ? {value: 4, display: '4', copyable: true} : null,
    listOpenWindows: all => all ? [{name: 'Firefox', window: 1}, {name: 'Terminal', window: 2}] : [{name: 'Firefox', window: 1}],
    searchSettingsPanels: query => [{name: 'Network', id: 'network', kind: 'settings'}].filter(x => !query || x.name.toLowerCase().includes(query.toLowerCase())),
};

test('resolves shared emoji, recent, web, and calculator results', () => {
    assert.equal(searchModeResults('emoji', 'smile', deps)[0].kind, 'emoji');
    assert.equal(searchModeResults('recent', 'report', deps)[0].kind, 'recent');
    assert.equal(searchModeResults('web', '  cats  ', deps)[0].query, 'cats');
    assert.equal(searchModeResults('calculator', '2 + 2', deps)[0].value, 4);
    assert.deepEqual(searchModeResults('calculator', 'bad', deps), []);
});

test('filters windows and delegates Settings search', () => {
    assert.equal(searchModeResults('window', 'fire', deps)[0].name, 'Firefox');
    assert.equal(searchModeResults('window', '', {...deps, allWorkspaces: true}).length, 2);
    assert.equal(searchModeResults('settings', 'network', deps)[0].id, 'network');
});

test('returns null for modes owned by individual layouts', () => {
    assert.equal(searchModeResults('apps', 'firefox', deps), null);
    assert.equal(searchModeResults('files', 'report', deps), null);
    assert.equal(searchModeResults('clipboard', 'text', deps), null);
});
