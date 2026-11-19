// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSnippets, serializeSnippets, searchSnippets, MAX_SNIPPETS} from '../lib/snippets.js';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('snippets are normalized from JSON and versioned objects', () => {
    const items = [{title: ' Reply ', trigger: ' RP ', content: 'Thanks!\nRegards'}];
    assert.deepEqual(normalizeSnippets(JSON.stringify(items)),
        [{id: 'rp', title: 'Reply', trigger: 'rp', content: 'Thanks!\nRegards', enabled: true}]);
    assert.equal(normalizeSnippets(serializeSnippets(items)).length, 1);
    assert.deepEqual(normalizeSnippets('{bad'), []);
});

test('invalid, duplicate and bounded entries are handled safely', () => {
    const items = [
        {title: 'A', content: 'one'},
        {title: 'A', content: 'two'},
        {title: 'B', trigger: 'a', content: 'three'},
        {title: 'C', content: ''},
        {title: 'D', trigger: 'bad trigger!', content: 'four'},
    ];
    assert.deepEqual(normalizeSnippets(items).map(s => s.title), ['A']);
    const many = Array.from({length: MAX_SNIPPETS + 5}, (_, i) =>
        ({title: `S${i}`, content: `text ${i}`}));
    assert.equal(normalizeSnippets(many).length, MAX_SNIPPETS);
});

test('search covers title, trigger and content and skips disabled entries', () => {
    const items = normalizeSnippets([
        {title: 'Reply', trigger: 'rp', content: 'Thanks and regards'},
        {title: 'Address', content: '123 Main Street'},
        {title: 'Hidden', content: 'secret', enabled: false},
    ]);
    assert.deepEqual(searchSnippets('RP', items).map(s => s.title), ['Reply']);
    assert.deepEqual(searchSnippets('main', items).map(s => s.title), ['Address']);
    assert.deepEqual(searchSnippets('regards', items).map(s => s.title), ['Reply']);
    assert.deepEqual(searchSnippets('secret', items), []);
    assert.equal(searchSnippets('', items).length, 2);
});

test('shared finder copies a snippet and never adds it to clipboard history', () => {
    const finder = read('../lib/finderSearch.js');
    assert.match(finder, /mode === 'snippets'/);
    assert.match(finder, /searchSnippets\(query, dependencies\.snippets/);
    assert.match(finder, /kind: 'snippet'/);

    const dialog = read('../lib/launcherDialog.js');
    assert.match(dialog, /if \(item\.kind === 'snippet'\)/);
    assert.match(dialog, /clipboard\.set_text\(St\.ClipboardType\.CLIPBOARD, item\.text\)/);
    assert.doesNotMatch(dialog, /copyToClipboard\(item\.text\)/);

    const prefs = read('../prefs.js');
    assert.match(prefs, /title: 'Text snippets'/);
    assert.match(prefs, /serializeSnippets/);
    assert.match(prefs, /changed::snippets/);
});
