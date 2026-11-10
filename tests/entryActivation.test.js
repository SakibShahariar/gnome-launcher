// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('search entry handles its activate signal as an Enter fallback', () => {
    const source = readFileSync(new URL('../lib/launcherDialog.js', import.meta.url), 'utf8');
    assert.ok(source.includes("clutter_text.connect('activate', () => this._activateEntry())"));
    assert.match(source, /_activateEntry\(\)\s*\{[\s\S]*this\._layout\.onEnter/);
});
