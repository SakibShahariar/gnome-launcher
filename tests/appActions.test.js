// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {activateDesktopAction, listDesktopActions} from '../lib/appActions.js';

test('lists localized desktop action labels in desktop-file order', () => {
    const app = {
        get_app_info: () => ({
            list_actions: () => ['new-window', 'preferences'],
            get_action_name: name => name === 'new-window' ? 'New Window' : 'Preferences',
        }),
    };

    assert.deepEqual(listDesktopActions(app), [
        {name: 'new-window', label: 'New Window'},
        {name: 'preferences', label: 'Preferences'},
    ]);
});

test('falls back to the action identifier when no localized label is available', () => {
    const app = {
        get_app_info: () => ({
            list_actions: () => ['custom-action'],
            get_action_name: () => null,
        }),
    };

    assert.deepEqual(listDesktopActions(app), [
        {name: 'custom-action', label: 'custom-action'},
    ]);
});

test('returns no actions for window-backed apps or unavailable metadata', () => {
    assert.deepEqual(listDesktopActions(null), []);
    assert.deepEqual(listDesktopActions({get_app_info: () => null}), []);
    assert.deepEqual(listDesktopActions({get_app_info: () => ({})}), []);
});

test('handles desktop metadata errors without breaking normal app launch', () => {
    const app = {get_app_info: () => ({list_actions: () => { throw new Error('unavailable'); }})};
    assert.deepEqual(listDesktopActions(app), []);
});

test('activates an action through Shell.App with the requested timestamp and default workspace', () => {
    const calls = [];
    const app = {launch_action: (...args) => calls.push(args)};

    assert.equal(activateDesktopAction(app, 'new-window', 1234), true);
    assert.deepEqual(calls, [['new-window', 1234, -1]]);
});

test('does not attempt to activate missing actions or unsupported apps', () => {
    assert.equal(activateDesktopAction(null, 'new-window'), false);
    assert.equal(activateDesktopAction({launch_action() {}}, ''), false);
    assert.equal(activateDesktopAction({}, 'new-window'), false);
});
