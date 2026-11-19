// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('dialog opts its surfaces into Blur my Shell per-surface blur', () => {
    const source = read('../lib/launcherDialog.js');
    assert.match(source, /this\._layout\.bmsBlurTargets \?\? \[this\._layoutRoot\]/);
    assert.match(source, /add_style_class_name\('bms-popup-blur-target'\)/);
    assert.match(source, /add_style_class_name\('bms-redraw-blur-instant'\)/);
});

test('dock exposes its two separate surfaces as blur targets', () => {
    const source = read('../lib/layouts/dock.js');
    assert.match(source, /this\.bmsBlurTargets = \[this\.resultsBox, searchRow\]/);
});

test('the dialog frame stays transparent despite BMS popup styling', () => {
    const dialog = read('../lib/launcherDialog.js');
    assert.match(dialog, /_modalBox\.add_style_class_name\('launcher-modal-box'\)/);
    assert.match(dialog, /MODAL_BOX_OVERRIDE/);
    assert.match(dialog, /background: transparent !important; border: none !important;/);
    const css = read('../stylesheet.css');
    assert.match(css, /\.modal-dialog\.launcher-dialog\.launcher-modal-box \{[\s\S]*?background: transparent !important;[\s\S]*?border: none !important;/);
});
