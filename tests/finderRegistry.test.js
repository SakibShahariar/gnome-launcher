// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {createFinderRegistry} from '../lib/finderRegistry.js';

test('looks up registered finders and returns a defensive list', () => {
    const registry = createFinderRegistry([
        {mode: 'apps', label: 'Applications'},
        {mode: 'settings', keyword: 'settings', label: 'Settings'},
    ]);

    assert.equal(registry.get('apps').label, 'Applications');
    assert.equal(registry.get('missing'), null);
    const list = registry.list();
    list.pop();
    assert.equal(registry.list().length, 2);
});

test('parses symbolic and word prefixes without consuming query text', () => {
    const registry = createFinderRegistry([
        {mode: 'run', prefix: '>'},
        {mode: 'settings', keyword: 'settings', caseInsensitive: true},
        {mode: 'window', prefix: 'w '},
    ]);

    assert.deepEqual(registry.parsePrefix('> top'), {mode: 'run', query: 'top'});
    assert.deepEqual(registry.parsePrefix('settings Network'), {mode: 'settings', query: 'Network'});
    assert.deepEqual(registry.parsePrefix('SETTINGS Displays'), {mode: 'settings', query: 'Displays'});
    assert.deepEqual(registry.parsePrefix('w '), {mode: 'window', query: ''});
    assert.equal(registry.parsePrefix('settingsx Network'), null);
    assert.equal(registry.parsePrefix('ordinary text'), null);
});

test('rejects invalid and duplicate finder definitions', () => {
    assert.throws(() => createFinderRegistry([{prefix: '>'}]), /mode/);
    assert.throws(() => createFinderRegistry([
        {mode: 'apps'},
        {mode: 'apps', prefix: 'a'},
    ]), /Duplicate finder mode/);
});

test('rejects duplicate prefixes and keywords, including case-only duplicates', () => {
    assert.throws(() => createFinderRegistry([
        {mode: 'run', prefix: '>'},
        {mode: 'other', prefix: '>'},
    ]), /Duplicate finder prefix/);
    assert.throws(() => createFinderRegistry([
        {mode: 'run', prefix: '>'},
        {mode: 'other', prefix: '>>'},
    ]), /Duplicate finder prefix/);
    assert.throws(() => createFinderRegistry([
        {mode: 'settings', keyword: 'settings', caseInsensitive: true},
        {mode: 'other', keyword: 'SETTINGS'},
    ]), /Duplicate finder keyword/);
    assert.doesNotThrow(() => createFinderRegistry([
        {mode: 'lower', keyword: 'settings'},
        {mode: 'upper', keyword: 'SETTINGS'},
    ]));
});

test('rejects prefixes and keywords that can claim the same input', () => {
    assert.throws(() => createFinderRegistry([
        {mode: 'short', prefix: 's'},
        {mode: 'settings', keyword: 'settings'},
    ]), /Ambiguous finder prefix and keyword/);
    assert.doesNotThrow(() => createFinderRegistry([
        {mode: 'window', prefix: 'w '},
        {mode: 'settings', keyword: 'settings'},
    ]));
});

test('rejects empty prefixes and keywords that would match ambiguously', () => {
    assert.throws(
        () => createFinderRegistry([{mode: 'run', prefix: ''}]),
        /prefix must not be empty/
    );
    assert.throws(
        () => createFinderRegistry([{mode: 'settings', keyword: '   '}]),
        /keyword must not be empty/
    );
    assert.throws(
        () => createFinderRegistry([{mode: 'settings', keyword: ''}]),
        /keyword must not be empty/
    );
});
