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

test('startup apps are rendered through each layout, not the shared rest card', () => {
    const dialog = read('../lib/launcherDialog.js');
    assert.match(dialog, /getStartupApps\(\)/);
    assert.match(dialog, /\[\.\.\.this\._pinnedApps, \.\.\.getRecentApps\(8\)\]/);
    assert.match(dialog, /this\._searchResults = this\.getStartupApps\(\);\s*this\._filtered = this\._searchResults;/);

    const restCard = read('../lib/restCard.js');
    assert.match(restCard, /theme\.showInitialPanel === false/);
    assert.match(restCard, /return new St\.Widget\(\{visible: false\}\)/);

    for (const file of [
        'adaptiveWidth', 'corner', 'dock', 'fullEdge', 'fullscreen', 'grid',
        'heroBanner', 'hotkey', 'list', 'sidebar', 'splitPreview', 'splitTabs', 'topDropdown',
    ]) {
        const source = read(`../lib/layouts/${file}.js`);
        assert.match(source,
            /if \(!this\.entry\.get_text\(\)\.trim\(\) && this\.theme\.showInitialPanel !== false\)/,
            file);
    }
});
