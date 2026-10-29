// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import {resolveDefaultMode} from '../lib/defaultMode.js';

const dialogSource = readFileSync(new URL('../lib/launcherDialog.js', import.meta.url), 'utf8');
const prefsSource = readFileSync(new URL('../prefs.js', import.meta.url), 'utf8');

test('accepts each shared mode-based finder', () => {
    for (const mode of ['apps', 'run', 'files', 'clipboard', 'window', 'calculator', 'web', 'recent', 'emoji', 'settings'])
        assert.equal(resolveDefaultMode(mode), mode);
});

test('unknown and layout-specific modes safely fall back to applications', () => {
    for (const mode of ['', 'power', 'missing', null, 1])
        assert.equal(resolveDefaultMode(mode), 'apps');
});

test('launcher applies the configured mode only to layouts with a mode switcher', () => {
    assert.ok(dialogSource.includes("typeof this._layout._switchMode === 'function'"));
    assert.ok(dialogSource.includes("resolveDefaultMode(settings.get_string('default-mode'))"));
    assert.ok(dialogSource.includes("if (defaultMode !== 'apps')"));
});

test('preferences expose the same supported finder choices', () => {
    for (const mode of ['apps', 'run', 'files', 'clipboard', 'window', 'calculator', 'web', 'recent', 'emoji', 'settings'])
        assert.ok(prefsSource.includes("'" + mode + "'"));
});
