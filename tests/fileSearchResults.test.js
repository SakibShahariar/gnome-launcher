// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {parseFindOutput, diversifyFindPaths, diversifyFileEntries, sourceArea, rankFileEntries} from '../lib/fileSearchResults.js';

test('diversifyFindPaths interleaves directories instead of filling from one', () => {
    const paths = [
        '/a/one', '/a/two', '/a/three',
        '/b/one', '/b/two',
        '/c/one',
    ];
    assert.deepEqual(diversifyFindPaths(paths, 4),
        ['/a/one', '/b/one', '/c/one', '/a/two']);
    assert.deepEqual(diversifyFindPaths(paths, 20),
        ['/a/one', '/b/one', '/c/one', '/a/two', '/b/two', '/a/three']);
    assert.deepEqual(diversifyFindPaths(paths, 2), ['/a/one', '/b/one']);
});

test('sourceArea keeps large trees in one group', () => {
    assert.equal(sourceArea('/go/pkg/mod/x/README.md'), '/go');
    assert.equal(sourceArea('/usr/share/doc/x/README.md'), '/usr');
    assert.equal(sourceArea('/home/sakib/Projects/ytui/README.md'), '/home/sakib/Projects');
    assert.equal(sourceArea('/home/sakib/Downloads/a.txt'), '/home/sakib/Downloads');
});

test('a single dense tree cannot dominate when its subdirectories differ', () => {
    const paths = [
        '/go/pkg/mod/a/README.md',
        '/go/pkg/mod/b/README.md',
        '/go/src/c/README.md',
        '/usr/share/doc/x/README.md',
        '/home/sakib/Projects/y/README.md',
    ];
    assert.deepEqual(diversifyFindPaths(paths, 10),
        ['/go/pkg/mod/a/README.md', '/usr/share/doc/x/README.md',
            '/home/sakib/Projects/y/README.md', '/go/pkg/mod/b/README.md',
            '/go/src/c/README.md']);
});

test('diversifyFindPaths handles malformed paths and invalid limits', () => {
    assert.deepEqual(diversifyFindPaths(['/a/one', '', null, 42, '/one'], 5),
        ['/a/one', '/one']);
    for (const limit of [0, -1, NaN, Infinity, undefined])
        assert.deepEqual(diversifyFindPaths(['/one'], limit), []);
    assert.deepEqual(diversifyFindPaths(null, 5), []);
});

test('diversifyFileEntries interleaves native results by directory', () => {
    const entries = [
        {path: '/a/1'}, {path: '/a/2'}, {path: '/b/1'}, {path: '/c/1'},
    ];
    assert.deepEqual(diversifyFileEntries(entries, 3),
        [{path: '/a/1'}, {path: '/b/1'}, {path: '/c/1'}]);
    assert.deepEqual(diversifyFileEntries(null, 3), []);
});

test('rankFileEntries prefers name matches and keeps subsequence matches', () => {
    const entries = [
        {path: '/a/xREADME.md'},
        {path: '/b/README.md'},
        {path: '/c/notes.txt'},
        {path: '/d/reading-memo.md'},
    ];
    assert.deepEqual(rankFileEntries(entries, 'readme').map(e => e.path),
        ['/b/README.md', '/a/xREADME.md', '/d/reading-memo.md']);
    assert.deepEqual(rankFileEntries(entries, ''), entries);
});

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

test('parseFindOutput returns no results for non-positive limits', () => {
    const output = '/one\0/two\0';
    for (const limit of [0, -1, -20])
        assert.deepEqual(parseFindOutput(output, limit), []);
});

test('parseFindOutput floors fractional limits and rejects non-finite limits', () => {
    const output = '/one\0/two\0/three\0';
    assert.deepEqual(parseFindOutput(output, 1.9), ['/one']);
    for (const limit of [NaN, Infinity, -Infinity, undefined])
        assert.deepEqual(parseFindOutput(output, limit), []);
});

test('parseFindOutput handles missing or non-string process output', () => {
    for (const output of [undefined, null, 42, {}, []])
        assert.deepEqual(parseFindOutput(output, 20), []);
});
