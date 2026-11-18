// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('schema exposes show-initial-panel, enabled by default', () => {
    const schema = read('../schemas/org.gnome.shell.extensions.gnome-launcher.gschema.xml');
    assert.match(schema, /<key name="show-initial-panel" type="b">\s*<default>true<\/default>/);
});

test('preferences expose a switch for the initial panel', () => {
    const source = read('../prefs.js');
    assert.match(source, /title: 'Startup'/);
    assert.match(source, /title: 'Show initial panel'/);
    assert.match(source, /settings\.get_boolean\('show-initial-panel'\)/);
    assert.match(source, /settings\.set_boolean\('show-initial-panel', initialPanelSwitch\.active\)/);
});

test('dialog passes the setting to layouts', () => {
    const source = read('../lib/launcherDialog.js');
    assert.match(source, /theme\.showInitialPanel = settings\.get_boolean\('show-initial-panel'\)/);
});

test('shared rest card shows favorites and recent apps when the setting is off', () => {
    const source = read('../lib/restCard.js');
    assert.match(source, /theme\.showInitialPanel === false/);
    assert.match(source, /pinnedApps\.forEach\(app => addUnique\(app, 'Favorite'\)\)/);
    assert.match(source, /getRecentApps\(8\)\.forEach\(app => addUnique\(app\)\)/);
});
