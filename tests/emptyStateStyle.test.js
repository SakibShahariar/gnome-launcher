// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../stylesheet.css', import.meta.url), 'utf8');
const emptyState = readFileSync(new URL('../lib/emptyState.js', import.meta.url), 'utf8');

test('empty-state geometry is centralized in the shared stylesheet', () => {
    assert.ok(css.includes('.launcher-empty-state {\n    font-size: 13px;\n    padding: 14px 16px;\n}'));
    assert.match(emptyState, /style_class: 'launcher-empty-state'/);
    assert.match(emptyState, /style: `color: \$\{theme\.muted \|\| theme\.on_surface_variant\};`/);
    assert.ok(!/font-size:\s*13px/.test(emptyState));
    assert.ok(!/padding:\s*14px 16px/.test(emptyState));
});
