// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {searchEmoji} from '../lib/emojiFinder.js';

test('searches emoji by name and keywords', () => {
    assert.ok(searchEmoji('smile').some(item => item.emoji === '😀'));
    assert.ok(searchEmoji('rocket').some(item => item.emoji === '🚀'));
    assert.ok(searchEmoji('coffee').some(item => item.emoji === '☕'));
    assert.ok(searchEmoji('password').some(item => item.emoji === '🔒'));
});

test('returns popular emoji for an empty query and handles limits safely', () => {
    assert.ok(searchEmoji('').length > 0);
    assert.equal(searchEmoji('', 5).length, 5);
    assert.deepEqual(searchEmoji('smile', 0), []);
    assert.deepEqual(searchEmoji(null), []);
});

test('returns structured entries with emoji and searchable metadata', () => {
    const result = searchEmoji('rainbow');
    assert.ok(result.some(item => item.emoji === '🌈' && item.name === 'rainbow'));
});
