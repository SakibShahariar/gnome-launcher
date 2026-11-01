// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {mapWithConcurrency} from '../lib/concurrentMap.js';

test('limits concurrent operations while preserving input order', async () => {
    let active = 0;
    let maximumActive = 0;

    const results = await mapWithConcurrency([0, 1, 2, 3, 4], 2, async value => {
        active++;
        maximumActive = Math.max(maximumActive, active);
        await new Promise(resolve => setTimeout(resolve, (4 - value) * 2));
        active--;
        return value * 2;
    });

    assert.equal(maximumActive, 2);
    assert.deepEqual(results, [0, 2, 4, 6, 8]);
});

test('does not schedule more work after cancellation is observed', async () => {
    let cancelled = false;
    const started = [];

    await mapWithConcurrency([0, 1, 2, 3, 4], 2, async value => {
        started.push(value);
        if (value === 0)
            cancelled = true;
        return value;
    }, () => cancelled);

    assert.deepEqual(started, [0, 1]);
});
