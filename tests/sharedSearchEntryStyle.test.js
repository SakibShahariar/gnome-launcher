// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../stylesheet.css', import.meta.url), 'utf8');
const layoutFiles = ['sidebar.js', 'splitTabs.js', 'heroBanner.js'];

test('mode layouts use the shared search-entry structural class', () => {
    for (const file of layoutFiles) {
        const source = readFileSync(new URL('../lib/layouts/' + file, import.meta.url), 'utf8');
        assert.ok(source.includes('launcher-search launcher-search-entry '), file);
    }
});

test('shared search-entry CSS owns background and border reset', () => {
    assert.ok(css.includes('.launcher-search-entry {\n    background: none;\n    border: none;\n}'));
    for (const selector of ['.launcher-sidebar-entry {', '.launcher-split-tabs-entry {', '.launcher-hero-entry {']) {
        const start = css.indexOf(selector);
        assert.notEqual(start, -1, selector);
        const end = css.indexOf('\n}', start);
        assert.notEqual(end, -1, selector);
        const rule = css.slice(start, end);
        assert.ok(!rule.includes('background: none;'), selector);
        assert.ok(!rule.includes('border: none;'), selector);
    }
});
