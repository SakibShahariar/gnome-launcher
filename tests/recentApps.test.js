// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {resolveRecentApps} from '../lib/recentApps.js';

const app = id => ({
    id,
    get_id: () => id,
    get_name: () => id,
    get_app_info: () => ({get_nodisplay: () => false}),
});

test('preserves GNOME usage order and respects the cap', () => {
    const apps = ['terminal.desktop', 'browser.desktop', 'files.desktop', 'music.desktop'].map(app);
    assert.deepEqual(resolveRecentApps(apps, 2), apps.slice(0, 2));
});

test('skips invalid, duplicate, and hidden apps without failing', () => {
    const visible = app('visible.desktop');
    const hidden = {
        ...app('hidden.desktop'),
        get_app_info: () => ({get_nodisplay: () => true}),
    };
    assert.deepEqual(resolveRecentApps([null, hidden, visible, visible]), [visible]);
});

test('handles invalid input and unavailable metadata defensively', () => {
    assert.deepEqual(resolveRecentApps(null), []);
    assert.deepEqual(resolveRecentApps([{}]), []);
    assert.deepEqual(resolveRecentApps([app('app.desktop')], 0), []);
    const unavailable = {...app('unavailable.desktop'), get_app_info: () => { throw new Error('metadata unavailable'); }};
    assert.deepEqual(resolveRecentApps([unavailable]), [unavailable]);
});

test('skips an app whose ID lookup throws and continues with valid apps', () => {
    const broken = {get_id: () => { throw new Error('broken desktop entry'); }};
    const visible = app('visible.desktop');
    assert.deepEqual(resolveRecentApps([broken, visible]), [visible]);
});

test('a hidden duplicate does not mask a later visible app with the same ID', () => {
    const hidden = {
        ...app('shared.desktop'),
        get_app_info: () => ({get_nodisplay: () => true}),
    };
    const visible = app('shared.desktop');
    assert.deepEqual(resolveRecentApps([hidden, visible]), [visible]);
});
