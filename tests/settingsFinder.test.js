// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {SETTINGS_PANELS, searchSettingsPanels} from '../lib/settingsFinder.js';

test('searches common GNOME Settings panels by name and keyword', () => {
    assert.ok(searchSettingsPanels('network').some(panel => panel.id === 'network'));
    assert.ok(searchSettingsPanels('monitor').some(panel => panel.id === 'display'));
    assert.ok(searchSettingsPanels('wireless').some(panel => panel.id === 'wifi'));
    assert.ok(searchSettingsPanels('apps').some(panel => panel.id === 'applications'));
    assert.ok(searchSettingsPanels('account').some(panel => panel.id === 'user-accounts'));
    assert.ok(searchSettingsPanels('assistive').some(panel => panel.id === 'universal-access'));
});

test('empty settings query returns all panels without mutating the registry', () => {
    const results = searchSettingsPanels('');
    assert.equal(results.length, SETTINGS_PANELS.length);
    results.pop();
    assert.equal(searchSettingsPanels('').length, SETTINGS_PANELS.length);
});

test('unknown settings queries return no matches', () => {
    assert.deepEqual(searchSettingsPanels('definitely-not-a-panel'), []);
    assert.deepEqual(searchSettingsPanels(null), searchSettingsPanels(''));
});

test('returned keyword arrays cannot mutate the settings registry', () => {
    const results = searchSettingsPanels('wifi');
    const wifi = results.find(panel => panel.id === 'wifi');
    assert.ok(wifi);
    wifi.keywords.push('injected keyword');
    assert.equal(searchSettingsPanels('injected keyword').some(panel => panel.id === 'wifi'), false);
    assert.ok(searchSettingsPanels('wireless').some(panel => panel.id === 'wifi'));
});

test('settings registry entries and keywords are immutable', () => {
    const panel = SETTINGS_PANELS.find(entry => entry.id === 'wifi');
    assert.ok(Object.isFrozen(SETTINGS_PANELS));
    assert.ok(Object.isFrozen(panel));
    assert.ok(Object.isFrozen(panel.keywords));
    assert.throws(() => panel.keywords.push('injected keyword'), TypeError);
    assert.throws(() => { panel.name = 'Changed'; }, TypeError);
    assert.ok(searchSettingsPanels('wireless').some(entry => entry.id === 'wifi'));
    assert.equal(searchSettingsPanels('injected keyword').some(entry => entry.id === 'wifi'), false);
});
