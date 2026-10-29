// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const extensionSource = readFileSync(new URL('../extension.js', import.meta.url), 'utf8');
const dialogSource = readFileSync(new URL('../lib/launcherDialog.js', import.meta.url), 'utf8');

test('extension disable cancels searches before closing and cleaning up shared services', () => {
    const disable = extensionSource.slice(extensionSource.indexOf('    disable() {'), extensionSource.indexOf('    _syncClipboardHistory() {'));
    const cancel = disable.indexOf('this._dialog?.cancelPendingSearches()');
    const close = disable.indexOf('this._dialog?.close()');
    const stopClipboard = disable.indexOf('ClipboardHistory.stopTracking()');
    const cleanupProvider = disable.indexOf('cleanupSearchProvider()');

    for (const position of [cancel, close, stopClipboard, cleanupProvider])
        assert.notEqual(position, -1);
    assert.ok(cancel < close, 'searches must be cancelled before close animation starts');
    assert.ok(close < stopClipboard, 'dialog must close before clipboard tracking stops');
    assert.ok(close < cleanupProvider, 'dialog must close before search provider cleanup');
    assert.ok(cancel < cleanupProvider, 'searches must be cancelled before provider cleanup');
});

test('closed signal reuses the same idempotent cancellation method', () => {
    assert.ok(dialogSource.includes("this.connect('closed', () => this.cancelPendingSearches());"));
    assert.ok(dialogSource.includes('cancelPendingSearches() {'));
    assert.ok(dialogSource.includes('this._layout?._cancelFileSearch?.();'));
});
