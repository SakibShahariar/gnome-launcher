// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
    normalizeQuicklinks, serializeQuicklinks, buildQuicklinkUrl, matchQuicklink, MAX_QUICKLINKS,
} from '../lib/quicklinks.js';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('valid shortcuts are normalized from JSON or versioned objects', () => {
    const links = [{trigger: ' YT ', name: 'Video', url: 'https://example.com/search?q={query}'}];
    assert.deepEqual(normalizeQuicklinks(JSON.stringify(links)),
        [{trigger: 'yt', name: 'Video', url: 'https://example.com/search?q={query}', enabled: true}]);
    assert.equal(normalizeQuicklinks(serializeQuicklinks(links)).length, 1);
    assert.deepEqual(normalizeQuicklinks('{bad json'), []);
});

test('unsafe, duplicate and malformed definitions are dropped and bounded', () => {
    const links = [
        {trigger: 'ok', url: 'https://example.com/?q={query}'},
        {trigger: 'OK', url: 'https://example.com/?q={query}'},
        {trigger: 'bad', url: 'file:///etc/passwd?q={query}'},
        {trigger: 'creds', url: 'https://user:pass@example.com/?q={query}'},
        {trigger: 'nop', url: 'https://example.com/'},
        {trigger: 'two', url: 'https://example.com/?a={query}&b={query}'},
        {trigger: 'bad trigger!', url: 'https://example.com/?q={query}'},
    ];
    assert.deepEqual(normalizeQuicklinks(links).map(link => link.trigger), ['ok']);
    const many = Array.from({length: MAX_QUICKLINKS + 10}, (_, i) =>
        ({trigger: `t${i}`, url: 'https://example.com/?q={query}'}));
    assert.equal(normalizeQuicklinks(many).length, MAX_QUICKLINKS);
});

test('matching requires a trigger plus a non-empty query', () => {
    const links = normalizeQuicklinks([
        {trigger: 'yt', url: 'https://example.com/?q={query}'},
        {trigger: 'off', url: 'https://example.com/?q={query}', enabled: false},
    ]);
    assert.equal(matchQuicklink('yt linux tiling', links).query, 'linux tiling');
    assert.equal(matchQuicklink('yt', links), null);
    assert.equal(matchQuicklink('off value', links), null);
    assert.equal(matchQuicklink('other value', links), null);
});

test('URLs encode the query as one component', () => {
    const link = {url: 'https://example.com/?q={query}'};
    assert.equal(buildQuicklinkUrl(link, 'a b&c'), 'https://example.com/?q=a%20b%26c');
    assert.equal(buildQuicklinkUrl(link, ''), null);
    assert.equal(buildQuicklinkUrl({url: 'https://example.com/'}, 'x'), null);
});

test('finder resolves and launches quick links without touching other finders', () => {
    const finder = read('../lib/finderSearch.js');
    assert.match(finder, /mode === 'quicklinks'/);
    assert.match(finder, /matchQuicklink\(query, dependencies\.quicklinks/);
    assert.match(finder, /kind: 'quicklinks'/);

    const dialog = read('../lib/launcherDialog.js');
    assert.match(dialog, /matchQuicklink\(text, normalizeQuicklinks\(this\._settings\.get_string\('quicklinks'\)\)\)/);
    assert.match(dialog, /Gio\.AppInfo\.launch_default_for_uri\(item\.url, null\)/);

    const prefs = read('../prefs.js');
    assert.match(prefs, /title: 'Quick links'/);
    assert.match(prefs, /serializeQuicklinks/);
    assert.match(prefs, /changed::quicklinks/);
});
