// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const layoutPaths = [
    '../lib/layouts/list.js',
    '../lib/layouts/corner.js',
    '../lib/layouts/notch.js',
    '../lib/layouts/grid.js',
    '../lib/layouts/dock.js',
    '../lib/layouts/hotkey.js',
    '../lib/layouts/fullscreen.js',
    '../lib/layouts/adaptiveWidth.js',
    '../lib/layouts/topDropdown.js',
    '../lib/layouts/splitPreview.js',
    '../lib/layouts/sidebar.js',
    '../lib/layouts/splitTabs.js',
    '../lib/layouts/heroBanner.js',
    '../lib/layouts/krunner.js',
    '../lib/layouts/fullEdge.js',
];

test('all layouts expose a keyboard-focusable, named search entry', () => {
    for (const path of layoutPaths) {
        const source = read(path);
        const start = source.indexOf('this.entry = new St.Entry({');
        assert.notEqual(start, -1, `${path} must construct a search entry`);
        const end = source.indexOf('});', start);
        const entry = source.slice(start, end);
        assert.match(entry, /can_focus:\s*true/, `${path} search entry must be focusable`);
    }
});

test('mode controls in reference layouts are focusable, named, and keyboard-activatable', () => {
    for (const path of [
        '../lib/layouts/sidebar.js',
        '../lib/layouts/heroBanner.js',
        '../lib/layouts/splitTabs.js',
    ]) {
        const source = read(path);
        assert.match(source, /can_focus:\s*(?:true|enabled)/, `${path} mode controls must be focusable`);
        assert.match(source, /accessible_name:\s*label/, `${path} mode controls need accessible names`);
        assert.match(source, /key-press-event/, `${path} mode controls need keyboard activation`);
        assert.match(source, /Clutter\.KEY_Return/);
        assert.match(source, /Clutter\.KEY_KP_Enter/);
        assert.match(source, /Clutter\.KEY_space/);
    }
});

test('shared stylesheet draws focus and selected-result indicators', () => {
    const css = read('../stylesheet.css');
    assert.match(css, /\.launcher-search-entry:focus/);
    assert.match(css, /\.launcher-result-selected\s*\{/);
    assert.match(css, /\.launcher-sidebar-rail-icon:focus/);
    assert.match(css, /\.launcher-hero-mode-circle:focus/);
    assert.match(css, /\.launcher-split-tabs-pill:focus/);
});
