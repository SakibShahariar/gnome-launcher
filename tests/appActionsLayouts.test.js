// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const layouts = [
    'adaptiveWidth', 'corner', 'dock', 'fullEdge', 'fullscreen',
    'grid', 'hotkey', 'heroBanner', 'krunner', 'list', 'notch',
    'sidebar', 'splitPreview', 'splitTabs', 'topDropdown',
];

const dialogSource = readFileSync(new URL('../lib/launcherDialog.js', import.meta.url), 'utf8');
const menuStart = dialogSource.indexOf('    openSelectedAppActions() {');
const menuEnd = dialogSource.indexOf('    _destroyAppActionsMenu()', menuStart);
const menuSource = dialogSource.slice(menuStart, menuEnd);

test('all 15 layouts route app-row right-clicks to the shared desktop-action menu', () => {
    for (const layout of layouts) {
        const source = readFileSync(new URL(`../lib/layouts/${layout}.js`, import.meta.url), 'utf8');
        assert.ok(source.includes('event.get_button() === Clutter.BUTTON_SECONDARY'), `${layout} handles secondary click`);
        assert.ok(source.includes('this.dialog.openAppActions(index)'), `${layout} reuses the shared action menu`);
        assert.ok(source.includes('this.dialog.launchIndex(index)'), `${layout} preserves primary-click launch`);
    }
});

test('keyboard and right-click paths share one menu implementation', () => {
    assert.ok(menuSource.includes('return this.openAppActions(this._selectedIndex, {launchIfEmpty: true});'));
    assert.ok(menuSource.includes('openAppActions(index, {launchIfEmpty = false} = {})'));
    assert.ok(menuSource.includes('new PopupMenu.PopupMenu(sourceActor, 0.5, St.Side.TOP)'));
    assert.ok(menuSource.includes('listDesktopActions(app)'));
    assert.ok(menuSource.includes('activateDesktopAction(app, action.name'));
});

test('right-click menu offers pinning even when an app has no desktop actions', () => {
    assert.ok(menuSource.includes('if (actions.length === 0 && launchIfEmpty)'));
    assert.ok(menuSource.includes('new PopupMenu.PopupMenuItem('));
    assert.ok(menuSource.includes("pinned ? 'Remove from Favorites' : 'Pin to Favorites'"));
    assert.ok(menuSource.includes('this._togglePinnedApp(app)'));
    assert.ok(menuSource.includes('this.launchSelected()'));
    assert.ok(menuSource.includes('launchIfEmpty = false'));
});

test('pinning persists the global desktop-ID list and refreshes ordered results', () => {
    assert.ok(dialogSource.includes("settings.get_strv('pinned-app-ids')"));
    assert.ok(dialogSource.includes("this._settings.set_strv('pinned-app-ids', this._pinnedAppIds)"));
    assert.ok(dialogSource.includes('orderAppsWithPinnedFirst('));
    assert.ok(dialogSource.includes('this._pinnedApps = getPinnedApps(this._allApps, this._pinnedAppIds)'));
    assert.ok(dialogSource.includes('this._rerender()'));
});
