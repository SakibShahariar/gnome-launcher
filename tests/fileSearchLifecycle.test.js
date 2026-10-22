// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    cancelPendingFileSearch,
    scheduleFileSearch,
} from '../lib/fileSearchLifecycle.js';

function harness(overrides = {}) {
    const state = {_fileSearchTimeoutId: 0, _fileSearchCancellable: null};
    let timerCallback;
    const removed = [];
    const calls = [];
    const cancellables = [];
    const options = {
        removeSource: id => removed.push(id),
        scheduleTimeout: callback => {
            timerCallback = callback;
            return 42;
        },
        sourceRemove: -1,
        createCancellable: () => {
            const value = {cancelled: false, cancel() { this.cancelled = true; },
                is_cancelled() { return this.cancelled; }};
            cancellables.push(value);
            return value;
        },
        search: async (query, cancellable) => {
            calls.push({query, cancellable});
            return [{name: query}];
        },
        isCurrent: () => true,
        onResults: result => calls.push({result}),
        onError: error => calls.push({error}),
        mapResults: results => results,
    };
    return {
        state, removed, calls, cancellables,
        schedule: (query, changes = {}) => scheduleFileSearch(state, query, {...options, ...overrides, ...changes}),
        fire: () => timerCallback(),
    };
}

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
    const state = {_fileSearchTimeoutId: 0, _fileSearchCancellable: null};
    assert.doesNotThrow(() => cancelPendingFileSearch(state, () => assert.fail()));
    assert.doesNotThrow(() => cancelPendingFileSearch(state, () => assert.fail()));
});

test('debounces and maps successful results through shared lifecycle', async () => {
    const h = harness();
    h.schedule('report', {mapResults: results => results.map(x => x.name.toUpperCase())});
    assert.equal(h.state._fileSearchTimeoutId, 42);
    assert.equal(h.fire(), -1);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.calls, [
        {query: 'report', cancellable: h.cancellables[0]},
        {result: ['REPORT']},
    ]);
    assert.equal(h.state._fileSearchTimeoutId, 0);
});

test('does not search if mode is no longer current when debounce fires', () => {
    const h = harness();
    h.schedule('stale', {isCurrent: () => false});
    assert.equal(h.fire(), -1);
    assert.deepEqual(h.calls, []);
});

test('does not publish results after the active search is cancelled', async () => {
    let resolveSearch;
    const h = harness({search: () => new Promise(resolve => { resolveSearch = resolve; })});
    h.schedule('old');
    h.fire();
    const cancellable = h.cancellables[0];
    cancelPendingFileSearch(h.state, () => {});
    resolveSearch([{name: 'old'}]);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(cancellable.is_cancelled(), true);
    assert.deepEqual(h.calls, []);
});

test('suppresses errors from stale searches and reports current errors', async () => {
    const h = harness({search: async () => { throw new Error('failed'); }});
    h.schedule('current');
    h.fire();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.calls.length, 1);
    assert.match(h.calls[0].error.message, /failed/);
});
