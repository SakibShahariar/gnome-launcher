// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {mapNativeFileResults} from '../lib/nativeFileSearch.js';

test('maps Nautilus search metadata to local file candidates in provider order', () => {
    const identifiers = [
        'file:///home/user/Documents/Report.pdf',
        'file:///home/user/Pictures/photo.png',
    ];
    const metadata = [
        {id: identifiers[0], name: 'Quarterly Report.pdf'},
        {id: identifiers[1], name: 'Holiday Photo.png'},
    ];

    assert.deepEqual(mapNativeFileResults(identifiers, metadata), [
        {uri: identifiers[0], name: 'Quarterly Report.pdf'},
        {uri: identifiers[1], name: 'Holiday Photo.png'},
    ]);
});

test('ignores non-local results and duplicate identifiers', () => {
    const uri = 'file:///home/user/report.txt';
    assert.deepEqual(mapNativeFileResults([
        uri,
        'smb://server/share/report.txt',
        'trash:///old-report.txt',
        uri,
    ], [{id: uri, name: 'report.txt'}]), [
        {uri, name: 'report.txt'},
    ]);
});

test('keeps valid local results when metadata is missing or unnamed', () => {
    const identifiers = [
        'file:///home/user/first.txt',
        'file:///home/user/second.txt',
    ];
    assert.deepEqual(mapNativeFileResults(identifiers, [
        {id: identifiers[0], name: ''},
    ]), [
        {uri: identifiers[0], name: null},
        {uri: identifiers[1], name: null},
    ]);
});

test('handles empty and malformed provider responses', () => {
    assert.deepEqual(mapNativeFileResults([], []), []);
    assert.deepEqual(mapNativeFileResults(null, null), []);
    assert.deepEqual(mapNativeFileResults([null, 42, 'not-a-uri'], []), []);
});

test('handles non-array provider metadata and identifiers defensively', () => {
    const uri = 'file:///home/user/notes.txt';
    assert.deepEqual(mapNativeFileResults([uri], {id: uri, name: 'Notes'}), [
        {uri, name: null},
    ]);
    assert.deepEqual(mapNativeFileResults(uri, []), []);
});
