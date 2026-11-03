// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const pickerSource = readFileSync(new URL('../lib/colorPicker.js', import.meta.url), 'utf8');
const activationSource = readFileSync(new URL('../lib/modeActivationRuntime.js', import.meta.url), 'utf8');
const dialogSource = readFileSync(new URL('../lib/launcherDialog.js', import.meta.url), 'utf8');

test('uses the XDG Screenshot portal request and response instead of direct screen capture', () => {
    assert.ok(pickerSource.includes("'org.freedesktop.portal.Screenshot'"));
    assert.ok(pickerSource.includes("'PickColor'"));
    assert.ok(pickerSource.includes("'org.freedesktop.portal.Request'"));
    assert.ok(pickerSource.includes("'Response'"));
    assert.ok(pickerSource.includes('signal_subscribe'));
    assert.ok(pickerSource.includes('formatPickedColor'));
    assert.ok(!pickerSource.includes('Gio.Subprocess'));
    assert.ok(!pickerSource.includes('Shell.Screenshot'));
});

test('subscribes to the predicted portal request path before making the call', () => {
    const subscribeAt = pickerSource.indexOf('subscribeToResponse(connection, expectedPath');
    const callAt = pickerSource.indexOf('connection.call(');
    assert.ok(subscribeAt >= 0 && callAt > subscribeAt);
    assert.ok(pickerSource.includes("uniqueName.replace(/^:/, '').replace(/\\./g, '_')"));
    assert.ok(pickerSource.includes('if (requestPath !== expectedPath)'));
});

test('waits for the launcher to close before opening the desktop picker', () => {
    assert.ok(activationSource.includes("dialog.connect('closed'"));
    assert.ok(activationSource.includes('pickScreenColor({'));
    assert.ok(activationSource.includes('ClipboardHistory.copyToClipboard(hex)'));
    assert.ok(activationSource.includes('Screen color picking is unavailable'));
    assert.ok(dialogSource.includes("item.kind === 'color'"));
});
