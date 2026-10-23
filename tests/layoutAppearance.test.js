// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    parseLayoutAppearanceOverrides,
    resolveLayoutAppearance,
    setLayoutAppearanceOverride,
} from '../lib/layoutAppearance.js';

const defaults = {scale: 1, opacity: 0.8};

test('uses global appearance defaults when a layout has no overrides', () => {
    assert.deepEqual(resolveLayoutAppearance('{}', 'list', defaults), defaults);
});

test('resolves overrides for only the selected layout', () => {
    const serialized = JSON.stringify({
        dock: {scale: 1.4, opacity: 0.5},
    });
    assert.deepEqual(resolveLayoutAppearance(serialized, 'dock', defaults), {
        scale: 1.4,
        opacity: 0.5,
    });
    assert.deepEqual(resolveLayoutAppearance(serialized, 'list', defaults), defaults);
});

test('allows scale and opacity overrides to be configured independently', () => {
    const serialized = setLayoutAppearanceOverride('{}', 'fullscreen', 'scale', 1.3);
    assert.deepEqual(resolveLayoutAppearance(serialized, 'fullscreen', defaults), {
        scale: 1.3,
        opacity: 0.8,
    });
});

test('clearing an override restores the global fallback and removes empty layout entries', () => {
    let serialized = setLayoutAppearanceOverride('{}', 'dock', 'scale', 1.4);
    serialized = setLayoutAppearanceOverride(serialized, 'dock', 'opacity', 0.4);
    serialized = setLayoutAppearanceOverride(serialized, 'dock', 'scale', null);
    assert.deepEqual(resolveLayoutAppearance(serialized, 'dock', defaults), {
        scale: 1,
        opacity: 0.4,
    });
    serialized = setLayoutAppearanceOverride(serialized, 'dock', 'opacity', null);
    assert.equal(serialized, '{}');
});

test('ignores malformed JSON, unknown layouts, and out-of-range stored values', () => {
    assert.deepEqual(parseLayoutAppearanceOverrides('{bad json'), {});
    assert.deepEqual(parseLayoutAppearanceOverrides(JSON.stringify({
        unknown: {scale: 1.2},
        dock: {scale: 99, opacity: -1},
        list: {scale: 1.2, opacity: 0.6},
    })), {list: {scale: 1.2, opacity: 0.6}});
});

test('rejects invalid new overrides instead of persisting them', () => {
    assert.throws(() => setLayoutAppearanceOverride('{}', 'dock', 'scale', 2));
    assert.throws(() => setLayoutAppearanceOverride('{}', 'missing', 'scale', 1));
    assert.throws(() => setLayoutAppearanceOverride('{}', 'dock', 'color', 1));
});
