// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../lib/launcherDialog.js', import.meta.url), 'utf8');

test('background opacity falls back to solid when Blur my Shell is inactive', () => {
    assert.match(source, /function blurMyShellActive\(\)/);
    assert.match(source, /manager\.getUuids\(\)\.some\(uuid =>/);
    assert.match(source, /uuid\.includes\('blur-my-shell'\)/);
    assert.match(source, /ExtensionState\.ENABLED/);
    assert.match(source, /ExtensionState\.ACTIVE/);
    assert.match(source,
        /theme\.opacity = blurMyShellActive\(\) \? layoutAppearance\.opacity : 1;/);
});
