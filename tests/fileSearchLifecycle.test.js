// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {cancelPendingFileSearch} from '../lib/fileSearchLifecycle.js';

test('removes a pending debounce and cancels the active search', () => {
    const removed = [];
    let cancelled = 0;
    const state = {
        _fileSearchTimeoutId: 42,
        _fileSearchCancellable: {cancel: () => cancelled++},
    };

    cancelPendingFileSearch(state, id => removed.push(id));

    assert.deepEqual(removed, [42]);
    assert.equal(cancelled, 1);
    assert.equal(state._fileSearchTimeoutId, 0);
    assert.equal(state._fileSearchCancellable, null);
});

test('is safe to call repeatedly when no search is pending', () => {
    let cancelled = 0;
    const state = {
        _fileSearchTimeoutId: 0,
        _fileSearchCancellable: null,
    };

    assert.doesNotThrow(() => cancelPendingFileSearch(state, () => {
        assert.fail('must not remove a nonexistent timeout');
    }));
    assert.doesNotThrow(() => cancelPendingFileSearch(state, () => {
        assert.fail('must not remove a nonexistent timeout');
    }));
    assert.equal(cancelled, 0);
});

test('cancels a search even when there is no debounce timeout', () => {
    let cancelled = 0;
    const state = {
        _fileSearchTimeoutId: 0,
        _fileSearchCancellable: {cancel: () => cancelled++},
    };

    cancelPendingFileSearch(state, () => assert.fail('unexpected timeout'));
    assert.equal(cancelled, 1);
    assert.equal(state._fileSearchCancellable, null);
});
