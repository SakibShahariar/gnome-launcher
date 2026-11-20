// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../lib/modes.js', import.meta.url), 'utf8');

test('find fallback scans the whole filesystem outside virtual mounts', () => {
    assert.match(source, /const FIND_PRUNED_PATHS = \[[^\]]*'\/proc'[^\]]*'\/sys'[^\]]*\]/);
    assert.match(source, /const findArgs = \['find', '\/', '\('\];/);
    assert.match(source, /FIND_PRUNED_PATHS\.forEach\(/);
    assert.match(source, /'\)', '-prune', '-o'/);
    assert.match(source, /'-iname', `\*\$\{escaped\}\*`, '-print0'/);
    assert.doesNotMatch(source, /'-maxdepth'/);
    assert.doesNotMatch(source, /'find', GLib\.get_home_dir\(\)/);
});
