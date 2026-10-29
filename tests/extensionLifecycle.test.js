// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../extension.js', import.meta.url), 'utf8');

test('extension disable closes the launcher before stopping shared search services', () => {
    const disable = source.slice(source.indexOf('    disable() {'), source.indexOf('    _syncClipboardHistory() {'));
    const close = disable.indexOf('this._dialog?.close()');
    const stopClipboard = disable.indexOf('ClipboardHistory.stopTracking()');
    const cleanupProvider = disable.indexOf('cleanupSearchProvider()');

    assert.notEqual(close, -1);
    assert.notEqual(stopClipboard, -1);
    assert.notEqual(cleanupProvider, -1);
    assert.ok(close < stopClipboard, 'dialog must close before clipboard tracking stops');
    assert.ok(close < cleanupProvider, 'dialog must close before search provider cleanup');
});
