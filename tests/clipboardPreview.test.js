// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../lib/clipboardHistory.js', import.meta.url), 'utf8');

test('clipboard image previews use decode-time scaling with a guarded fallback', () => {
    assert.match(source, /loader\.connect\('size-prepared'/);
    assert.match(source, /loader\.set_size\(/);
    assert.match(source, /if \(!downscaled\)/);
    assert.equal((source.match(/\.scale_simple\(/g) ?? []).length, 1);
});
