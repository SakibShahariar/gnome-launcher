// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const theme = readFileSync(new URL('../lib/theme.js', import.meta.url), 'utf8');
const extension = readFileSync(new URL('../extension.js', import.meta.url), 'utf8');

test('theme cache validates file identity and metadata before reuse', () => {
    assert.match(theme, /_themeCache\?\.path === path && _themeCache\.signature === metadata\.signature/);
    assert.match(theme, /time::modified-usec/);
    assert.match(theme, /etag::value/);
});

test('wallpaper cache tracks preference candidates and rechecks higher-priority paths', () => {
    assert.match(theme, /_wallpaperCache\?\.candidatesKey === candidatesKey/);
    assert.match(theme, /higherPriorityExists/);
    assert.match(theme, /metadata\.signature === _wallpaperCache\.signature/);
});

test('theme and wallpaper caches are cleared on extension disable', () => {
    assert.match(theme, /export function clearThemeCaches\(\)/);
    assert.match(extension, /clearThemeCaches\(\);/);
});
