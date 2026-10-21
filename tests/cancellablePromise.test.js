// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {awaitWithCancellation} from '../lib/cancellablePromise.js';

class FakeCancellable {
    constructor() {
        this.cancelled = false;
        this.handlers = new Map();
        this.nextId = 1;
    }

    is_cancelled() {
        return this.cancelled;
    }

    connect(callback) {
        const id = this.nextId++;
        this.handlers.set(id, callback);
        if (this.cancelled)
            callback();
        return id;
    }

    disconnect(id) {
        this.handlers.delete(id);
    }

    cancel() {
        this.cancelled = true;
        for (const callback of this.handlers.values())
            callback();
    }
}

test('returns a completed operation result and disconnects cancellation handler', async () => {
    const cancellable = new FakeCancellable();

    assert.equal(await awaitWithCancellation(Promise.resolve(42), cancellable), 42);
    assert.equal(cancellable.handlers.size, 0);
});

test('settles promptly when cancellation occurs before the operation resolves', async () => {
    const cancellable = new FakeCancellable();
    let resolveOperation;
    const operation = new Promise(resolve => {
        resolveOperation = resolve;
    });

    const result = awaitWithCancellation(operation, cancellable);
    cancellable.cancel();

    assert.equal(await result, null);
    assert.equal(cancellable.handlers.size, 0);
    resolveOperation('late result');
});

test('does not wait for an operation when already cancelled', async () => {
    const cancellable = new FakeCancellable();
    cancellable.cancel();

    assert.equal(await awaitWithCancellation(new Promise(() => {}), cancellable), null);
});

test('propagates operation errors when not cancelled', async () => {
    const cancellable = new FakeCancellable();

    await assert.rejects(
        awaitWithCancellation(Promise.reject(new Error('provider failed')), cancellable),
        /provider failed/
    );
    assert.equal(cancellable.handlers.size, 0);
});
