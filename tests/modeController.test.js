// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {resetModeState} from '../lib/modeController.js';

test('resets common mode state and cancels app and file searches', () => {
    let appCancelled = false;
    let fileCancelled = false;
    const layout = {
        dialog: {_searchCancellable: {cancel() { appCancelled = true; }}},
        _cancelFileSearch() { fileCancelled = true; },
        _pendingPowerActionId: 'restart',
        mode: 'apps',
        _modeResults: [{name: 'old'}],
        _modeSelectedIndex: 4,
        _windowStart: 3,
        _modeWindowStart: 2,
    };

    resetModeState(layout, 'settings');

    assert.equal(appCancelled, true);
    assert.equal(layout.dialog._searchCancellable, null);
    assert.equal(fileCancelled, true);
    assert.equal(layout._pendingPowerActionId, null);
    assert.equal(layout.mode, 'settings');
    assert.deepEqual(layout._modeResults, []);
    assert.equal(layout._modeSelectedIndex, 0);
    assert.equal(layout._windowStart, 0);
    assert.equal(layout._modeWindowStart, 0);
});
