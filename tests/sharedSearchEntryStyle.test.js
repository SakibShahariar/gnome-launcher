// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../stylesheet.css', import.meta.url), 'utf8');
const layoutFiles = [
    'adaptiveWidth.js', 'corner.js', 'dock.js', 'fullEdge.js', 'fullscreen.js',
    'grid.js', 'heroBanner.js', 'hotkey.js', 'list.js',
    'sidebar.js', 'splitPreview.js', 'splitTabs.js', 'topDropdown.js',
];

test('all 13 layouts use the shared search-entry structural class', () => {
    assert.equal(layoutFiles.length, 13);
    for (const file of layoutFiles) {
        const source = readFileSync(new URL('../lib/layouts/' + file, import.meta.url), 'utf8');
        assert.match(source, /style_class: 'launcher-search launcher-search-entry launcher-[a-z-]+-entry'/, file);
    }
});

test('shared card frame owns common border declarations', () => {
    assert.ok(css.includes('/* Shared card frame; layout-specific radii, padding, and edge cut-outs stay below. */'));
    for (const selector of ['.launcher-list-card', '.launcher-grid-card', '.launcher-sidebar-card']) {
        const start = css.indexOf(selector + ' {');
        if (start === -1)
            continue; // A layout with no remaining local declarations needs no standalone rule.
        const end = css.indexOf('\n}', start);
        assert.notEqual(end, -1, selector);
        const rule = css.slice(start, end);
        assert.ok(!rule.includes('border-width: 1px;'), selector);
        assert.ok(!rule.includes('border-style: solid;'), selector);
    }
});

test('shared entry CSS owns background and border reset declarations once', () => {
    const shared = css.match(/\.launcher-search-entry,[\s\S]*?\n\}/)?.[0] ?? '';
    assert.ok(shared.includes('background: none !important;'), 'shared entry must clear theme backgrounds');
    assert.ok(shared.includes('border: none !important;'), 'shared entry must clear theme borders');
    assert.ok(shared.includes('box-shadow: none !important;'), 'shared entry must clear theme shadows');
    assert.ok(!css.includes('rgba(0, 0, 0, 0.01)'), 'focus wash must not be a dark shade');
    const rules = css.match(/\.launcher-[a-z-]+-entry \{[^}]*\}/g) ?? [];
    for (const rule of rules.filter(rule => !rule.startsWith('.launcher-search-entry'))) {
        assert.ok(!rule.includes('background: none;'), rule);
        assert.ok(!rule.includes('border: none;'), rule);
    }
});

test('shared layout typography and geometry are centralized', () => {
    assert.ok(css.includes('.launcher-hotkey-number,\n.launcher-hotkey-label,'));
    assert.ok(css.includes('.launcher-corner-entry,\n.launcher-full-edge-entry,'));
    assert.ok(css.includes('.launcher-hotkey-search-row,\n.launcher-list-search-row,'));
    assert.ok(css.includes('.launcher-hotkey-result-row,\n.launcher-list-result-row,'));
    assert.ok(css.includes('.launcher-list-card,\n.launcher-hotkey-card,'));
});
