// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../lib/modes.js', import.meta.url), 'utf8');

test('find scans home always and the whole filesystem as fallback', () => {
    assert.match(source, /const FIND_PRUNED_PATHS = \[[^\]]*'\/proc'[^\]]*'\/sys'[^\]]*\]/);
    assert.match(source, /async function runFindScan\(root, trimmed, cancellable, pruneVirtual\)/);
    assert.match(source, /const args = \['find', root\]/);
    assert.match(source, /if \(pruneVirtual\)/);
    assert.match(source, /FIND_PRUNED_PATHS\.forEach\(/);
    assert.match(source, /'\)', '-prune', '-o'/);
    assert.match(source, /'-iname', `\*\$\{escaped\}\*`, '-print0'/);
    assert.match(source, /runFindScan\(GLib\.get_home_dir\(\), trimmed, cancellable, false\)/);
    assert.match(source, /runFindScan\('\/', trimmed, cancellable, true\)/);
    assert.match(source, /\[\.\.\.nativeEntries, \.\.\.homePaths\.map\(path => \(\{path\}\)\)\]/);
    assert.doesNotMatch(source, /'-maxdepth'/);
});
