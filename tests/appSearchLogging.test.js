// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../lib/appSearch.js', import.meta.url), 'utf8');

test('routine native app-search successes do not write a journal entry per query', () => {
    assert.doesNotMatch(source, /native search returned \$\{results\.length\} launchable results/);
});

test('native-search fallback diagnostics remain available', () => {
    assert.match(source, /native search returned no launchable results; using fuzzy fallback/);
    assert.match(source, /native search failed at runtime/);
});
