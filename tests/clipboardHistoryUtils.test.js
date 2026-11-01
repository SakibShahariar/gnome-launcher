// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {getOrCreatePreviewContent, rememberTextEntry, releasePreviewContent} from '../lib/clipboardHistoryUtils.js';

test('moves an existing text entry to the front without disturbing other entries', () => {
    const image = {kind: 'image', name: 'Image from clipboard'};
    const oldText = {kind: 'text', name: 'older', text: 'older', timestamp: 1};
    const repeated = {kind: 'text', name: 'copied', text: 'copied', timestamp: 2};
    const history = [image, oldText, repeated];

    const result = rememberTextEntry(history, 'copied', 3, 20);

    assert.equal(result, history);
    assert.deepEqual(history, [
        {kind: 'text', name: 'copied', text: 'copied', timestamp: 3},
        image,
        oldText,
    ]);
});

test('adds new text and preserves the history size limit', () => {
    const history = Array.from({length: 20}, (_, index) => ({
        kind: 'text',
        name: String(index),
        text: String(index),
        timestamp: index,
    }));

    rememberTextEntry(history, 'new entry', 21, 20);

    assert.equal(history.length, 20);
    assert.equal(history[0].text, 'new entry');
    assert.equal(history.some(item => item.text === '19'), false);
});

test('keeps image entries and ordering intact when a text duplicate is moved', () => {
    const firstImage = {kind: 'image', name: 'first image'};
    const secondImage = {kind: 'image', name: 'second image'};
    const history = [
        firstImage,
        {kind: 'text', name: 'other', text: 'other', timestamp: 1},
        secondImage,
        {kind: 'text', name: 'target', text: 'target', timestamp: 2},
    ];

    rememberTextEntry(history, 'target', 3, 20);

    assert.equal(history[0].text, 'target');
    assert.deepEqual(history.slice(1), [
        firstImage,
        {kind: 'text', name: 'other', text: 'other', timestamp: 1},
        secondImage,
    ]);
});

test('reuses preview content across clipboard search wrappers for the same bytes', () => {
    const bytes = {};
    const historyEntry = {kind: 'image', bytes};
    const searchResult = {...historyEntry, kind: 'clipboard-image'};
    let creations = 0;
    const create = () => ({id: ++creations});

    const first = getOrCreatePreviewContent(historyEntry, create);
    const second = getOrCreatePreviewContent(searchResult, create);

    assert.equal(second, first);
    assert.equal(creations, 1);

    releasePreviewContent(historyEntry);
    const third = getOrCreatePreviewContent(searchResult, create);
    assert.notEqual(third, first);
    assert.equal(creations, 2);
});

test('releases cached preview content when history entries are evicted', () => {
    const retained = {kind: 'image', bytes: {}};
    const evicted = {kind: 'image', bytes: {}};
    const history = [retained, evicted];
    let creations = 0;
    const create = () => ({id: ++creations});

    getOrCreatePreviewContent(evicted, create);
    rememberTextEntry(history, 'new text', 3, 2);

    assert.equal(history.length, 2);
    assert.notEqual(getOrCreatePreviewContent(evicted, create).id, 1);
    assert.equal(creations, 2);
});
