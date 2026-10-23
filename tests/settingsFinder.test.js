// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {SETTINGS_PANELS, searchSettingsPanels} from '../lib/settingsFinder.js';

test('searches common GNOME Settings panels by name and keyword', () => {
    assert.ok(searchSettingsPanels('network').some(panel => panel.id === 'network'));
    assert.ok(searchSettingsPanels('monitor').some(panel => panel.id === 'display'));
    assert.ok(searchSettingsPanels('wireless').some(panel => panel.id === 'wifi'));
    assert.ok(searchSettingsPanels('apps').some(panel => panel.id === 'applications'));
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
