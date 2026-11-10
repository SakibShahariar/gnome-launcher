// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const shellModuleFiles = [
    '../lib/clipboardQr.js',
    '../lib/launcherDialog.js',
];

test('GNOME Shell main module is imported as a namespace', () => {
    for (const path of shellModuleFiles) {
        const source = readFileSync(new URL(path, import.meta.url), 'utf8');
        assert.ok(
            source.includes("import * as Main from 'resource:///org/gnome/shell/ui/main.js';"),
            `${path} must use the GNOME Shell main module namespace`
        );
        assert.ok(
            !source.includes("import Main from 'resource:///org/gnome/shell/ui/main.js';"),
            `${path} must not request a nonexistent default export`
        );
    }
});
