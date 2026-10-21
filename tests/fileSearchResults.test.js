// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {parseFindOutput} from '../lib/fileSearchResults.js';

test('parseFindOutput preserves paths containing newline characters', () => {
    const paths = ['/home/user/normal.txt', '/home/user/name\nwith-newline.txt'];
    assert.deepEqual(parseFindOutput(paths.join('\0') + '\0', 20), paths);
});

test('parseFindOutput ignores empty records and applies the result limit', () => {
    assert.deepEqual(parseFindOutput('\0/one\0\0/two\0/three\0', 2), ['/one', '/two']);
});

test('parseFindOutput handles empty output', () => {
    assert.deepEqual(parseFindOutput('', 20), []);
});
