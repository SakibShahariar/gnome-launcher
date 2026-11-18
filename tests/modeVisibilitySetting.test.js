// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeVisibleModes, filterModes, MODE_OPTIONS} from '../lib/modeVisibility.js';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('schema exposes visible-modes with all defaults', () => {
    const schema = read('../schemas/org.gnome.shell.extensions.gnome-launcher.gschema.xml');
    assert.match(schema, /<key name="visible-modes" type="as">/);
    for (const {id} of MODE_OPTIONS)
        assert.ok(schema.includes(`'${id}'`), `default list must include ${id}`);
});

test('normalizeVisibleModes always keeps apps and drops unknown ids', () => {
    assert.deepEqual(normalizeVisibleModes(null), ['apps']);
    assert.deepEqual(normalizeVisibleModes(['files', 'bogus', 'files']), ['apps', 'files']);
    assert.deepEqual(normalizeVisibleModes(['apps', 'web', 'apps']), ['apps', 'web']);
});

test('filterModes keeps only enabled mode definitions', () => {
    const definitions = [['apps'], ['files'], ['web']];
    assert.deepEqual(filterModes(definitions, ['apps', 'web']), [['apps'], ['web']]);
    assert.deepEqual(filterModes(definitions, []), [['apps']]);
});

test('preferences expose check buttons for each mode', () => {
    const source = read('../prefs.js');
    assert.match(source, /title: 'Visible modes'/);
    assert.match(source, /MODE_OPTIONS\)/);
    assert.match(source, /settings\.set_strv\('visible-modes', normalizeVisibleModes\(ids\)\)/);
    assert.match(source, /changed::visible-modes/);
});

test('dialog passes visible modes to layouts and honors them for the default mode', () => {
    const source = read('../lib/launcherDialog.js');
    assert.match(source, /theme\.visibleModes = normalizeVisibleModes\(settings\.get_strv\('visible-modes'\)\)/);
    assert.match(source, /theme\.visibleModes\.includes\(defaultMode\)/);
});

test('all three mode layouts filter their switchers by the setting', () => {
    for (const file of ['sidebar.js', 'splitTabs.js', 'heroBanner.js']) {
        const source = read(`../lib/layouts/${file}`);
        assert.match(source, /filterModes\(MODES, theme\.visibleModes\)/, file);
        assert.match(source, /this\._modes/, file);
        assert.doesNotMatch(source, /for \(const \[modeIndex, \[modeId[^\n]*\] of MODES/, file);
    }
});

test('mode switches hand key focus back to the search entry', () => {
    const dialog = read('../lib/launcherDialog.js');
    assert.match(dialog, /focusSearchEntry\(\)/);
    assert.match(dialog, /grab_key_focus\(\)/);
    for (const file of ['sidebar.js', 'splitTabs.js', 'heroBanner.js']) {
        const source = read(`../lib/layouts/${file}`);
        assert.match(source, /_switchMode\(modeId\) \{\s*this\.dialog\.focusSearchEntry\(\);/, file);
    }
});
