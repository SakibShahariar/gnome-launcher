// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const variants = {
    adaptiveWidth: 'compact',
    corner: 'compact',
    dock: 'compact',
    fullEdge: 'compact',
    fullscreen: 'full',
    grid: 'compact',
    hotkey: 'compact',
    heroBanner: 'full',
    list: 'full',
    sidebar: 'full',
    splitPreview: 'compact',
    splitTabs: 'full',
    topDropdown: 'full',
};

test('all 13 layouts show a rest card for an empty application query', () => {
    for (const [name, variant] of Object.entries(variants)) {
        const source = readFileSync(new URL(`../lib/layouts/${name}.js`, import.meta.url), 'utf8');
        assert.ok(source.includes('makeRestCard'), `${name} imports the shared rest card`);
        assert.ok(source.includes('if (!this.entry.get_text().trim() && this.theme.showInitialPanel !== false)'), `${name} handles an empty query`);
        assert.ok(source.includes(`variant: '${variant}'`), `${name} uses the ${variant} rest-card variant`);
        assert.ok(source.includes('pinnedApps: this.dialog._pinnedApps'), `${name} supplies global favorites to the rest card`);
    }
});

test('rest-card hints list every registered finder prefix', () => {
    const source = readFileSync(new URL('../lib/restCard.js', import.meta.url), 'utf8');
    for (const hint of ['> run', '/ files', '; clipboard', '! power', '= calculate', '? web', 'w windows', 'recent', 'emoji', 's settings', 'color'])
        assert.ok(source.includes(hint), `missing finder hint: ${hint}`);
    assert.ok(source.includes('showRecentApps && !compact'));
    assert.ok(source.includes("text: 'Favorites'"));
    assert.ok(source.includes('can_focus: true'));
    assert.ok(source.includes('onActivate(app)'));
    assert.ok(source.includes('accessible_name: accessiblePrefix ?'));
    assert.ok(source.indexOf("text: 'Favorites'") < source.indexOf('if (showRecentApps && !compact)'));
    assert.ok(source.includes('label.clutter_text.set_line_wrap(true)'));
});

test('list moves finder hints into its footer', () => {
    const source = readFileSync(new URL('../lib/layouts/list.js', import.meta.url), 'utf8');
    assert.match(source, /FINDER_HINT_SUMMARY/);
    assert.match(source, /showFinderHints: false/);
    assert.match(source, /this\.footer\.set_text\(FINDER_HINT_SUMMARY\)/);
});

test('split tabs shows finder hints in the left pane on empty apps query', () => {
    const source = readFileSync(new URL('../lib/layouts/splitTabs.js', import.meta.url), 'utf8');
    assert.match(source, /this\.hints = makeFinderHints\(this\.theme, \{compact: true\}\)/);
    assert.match(source, /this\.hints\.visible = this\.mode === 'apps' && !this\.entry\.get_text\(\)\.trim\(\)/);
    assert.match(source, /variant: 'full', showFinderHints: false/);
});

test('split preview shows finder hints in the right-hand pane', () => {
    const source = readFileSync(new URL('../lib/layouts/splitPreview.js', import.meta.url), 'utf8');
    assert.match(source, /makeFinderHints\(this\.theme, \{compact: true\}\)/);
    assert.match(source, /this\.preview\.add_child\(makeFinderHints/);
    assert.match(source, /variant: 'compact', showFinderHints: false/);
});

test('compact rest cards place finder hints before favorites, full cards after', () => {
    const source = readFileSync(new URL('../lib/restCard.js', import.meta.url), 'utf8');
    const compactHints = source.indexOf('if (compact)\n        addHints();');
    const favorites = source.indexOf("text: 'Favorites'");
    const recent = source.indexOf('if (showRecentApps && !compact)');
    const fullHints = source.indexOf('if (!compact)\n        addHints();');
    assert.ok(compactHints > 0, 'compact hint placement exists');
    assert.ok(compactHints < favorites, 'compact hints come before favorites');
    assert.ok(recent < fullHints, 'full-card hints come after recent apps');
});

test('Hotkey rest card preserves the Ctrl+1–9 launch hint without taking digit keys', () => {
    const source = readFileSync(new URL('../lib/layouts/hotkey.js', import.meta.url), 'utf8');
    assert.ok(source.includes('Ctrl+1–9 to launch'));
    assert.ok(source.includes("variant: 'compact'"));
    assert.ok(source.includes('onDigitKey(localIndex)'));
    assert.ok(source.includes("if (!this.entry.get_text().trim() && this.theme.showInitialPanel !== false)"));

});


test('launcher dialog supplies the shared launch callback to every rest card', () => {
    const dialog = readFileSync(new URL('../lib/launcherDialog.js', import.meta.url), 'utf8');
    assert.ok(dialog.includes('theme.launchApp = app => this.launchApp(app);'));
    assert.ok(dialog.includes('launchApp(app) {'));
    assert.ok(dialog.includes('return this.launchApp(this._filtered[index]);'));
});
