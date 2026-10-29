// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../stylesheet.css', import.meta.url), 'utf8');
const layoutFiles = [
    'adaptiveWidth.js', 'corner.js', 'dock.js', 'fullEdge.js', 'fullscreen.js',
    'grid.js', 'heroBanner.js', 'hotkey.js', 'krunner.js', 'list.js', 'notch.js',
    'sidebar.js', 'splitPreview.js', 'splitTabs.js', 'topDropdown.js',
];

test('all 15 layouts use the shared search-entry structural class', () => {
    assert.equal(layoutFiles.length, 15);
    for (const file of layoutFiles) {
        const source = readFileSync(new URL('../lib/layouts/' + file, import.meta.url), 'utf8');
        assert.match(source, /style_class: 'launcher-search launcher-search-entry launcher-[a-z-]+-entry'/, file);
    }
});

test('shared card frame owns common border declarations', () => {
    assert.ok(css.includes('/* Shared card frame; layout-specific radii, padding, and edge cut-outs stay below. */'));
    for (const selector of ['.launcher-list-card {', '.launcher-grid-card {', '.launcher-sidebar-card {']) {
        const start = css.indexOf(selector);
        const end = css.indexOf('\n}', start);
        assert.notEqual(start, -1, selector);
        assert.notEqual(end, -1, selector);
        const rule = css.slice(start, end);
        assert.ok(!rule.includes('border-width: 1px;'), selector);
        assert.ok(!rule.includes('border-style: solid;'), selector);
    }
});

test('shared entry CSS owns background and border reset declarations once', () => {
    assert.ok(css.includes('.launcher-search-entry {\n    background: none;\n    border: none;\n}'));
    const rules = css.match(/\.launcher-[a-z-]+-entry \{[^}]*\}/g) ?? [];
    for (const rule of rules.filter(rule => !rule.startsWith('.launcher-search-entry'))) {
        assert.ok(!rule.includes('background: none;'), rule);
        assert.ok(!rule.includes('border: none;'), rule);
    }
});
