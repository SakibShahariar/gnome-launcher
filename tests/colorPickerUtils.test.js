// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {formatPickedColor} from '../lib/colorPickerUtils.js';

test('formats normalized sRGB channels as uppercase six-digit hex', () => {
    assert.equal(formatPickedColor([1, 0, 0]), '#FF0000');
    assert.equal(formatPickedColor([0, 1, 0]), '#00FF00');
    assert.equal(formatPickedColor([0, 0, 1]), '#0000FF');
    assert.equal(formatPickedColor([0.2, 0.4, 0.6]), '#336699');
});

test('clamps valid channel values to the sRGB range', () => {
    assert.equal(formatPickedColor([-1, 0.5, 2]), '#0080FF');
});

test('rejects malformed or non-finite portal color values', () => {
    for (const value of [null, 'red', [], [1, 0], [1, 0, 0, 1], [NaN, 0, 0], [0, Infinity, 0]])
        assert.equal(formatPickedColor(value), null);
});
