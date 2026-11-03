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

test('right-clicking an app without desktop actions does not launch it accidentally', () => {
    const noActions = menuSource.indexOf('if (actions.length === 0)');
    const fallback = menuSource.indexOf('if (!launchIfEmpty)', noActions);
    const launch = menuSource.indexOf('this.launchSelected()', fallback);
    assert.ok(noActions >= 0 && fallback > noActions && launch > fallback);
    assert.ok(menuSource.includes('launchIfEmpty = false'));
});
