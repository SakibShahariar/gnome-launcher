// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {formatClockTime} from '../lib/clockFormat.js';

function dateTime() {
    const formats = [];
    return {formats, format(pattern) { formats.push(pattern); return pattern === '%l:%M %p' ? ' 1:05 PM ' : '13:05'; }};
}

test('uses the 12-hour format and trims GLib padding', () => {
    const date = dateTime();
    assert.equal(formatClockTime(date, '12h'), '1:05 PM');
    assert.deepEqual(date.formats, ['%l:%M %p']);
});

test('uses 24-hour format unless the preference is explicitly 12-hour', () => {
    const date = dateTime();
    assert.equal(formatClockTime(date, '24h'), '13:05');
    assert.equal(formatClockTime(date, 'unexpected'), '13:05');
    assert.deepEqual(date.formats, ['%H:%M', '%H:%M']);
});
