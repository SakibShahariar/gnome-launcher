// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {LAYOUT_NAMES} from '../lib/layoutNames.js';
import {LAYOUT_GALLERY} from '../lib/layoutGallery.js';

test('layout gallery covers every registered layout exactly once', () => {
    assert.deepEqual(LAYOUT_GALLERY.map(entry => entry.id), LAYOUT_NAMES);
    assert.equal(new Set(LAYOUT_GALLERY.map(entry => entry.id)).size, LAYOUT_NAMES.length);
});

test('every gallery entry has a title, description, and matching screenshot asset name', () => {
    for (const entry of LAYOUT_GALLERY) {
        assert.ok(entry.title.length > 0, `${entry.id} has a title`);
        assert.ok(entry.description.length > 0, `${entry.id} has a description`);
        assert.match(entry.screenshot, /^[A-Za-z]+\.png$/, `${entry.id} has a safe screenshot filename`);
    }
});

test('mode-control descriptions identify only the three mode layouts', () => {
    const modeLayouts = LAYOUT_GALLERY
        .filter(entry => entry.description.includes('Mode controls: yes'))
        .map(entry => entry.id);
    assert.deepEqual(modeLayouts, ['sidebar', 'split-tabs', 'hero-banner']);
});
