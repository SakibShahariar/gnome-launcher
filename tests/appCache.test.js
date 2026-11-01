// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {createInvalidatedCache, createUsageRankCache} from '../lib/appCache.js';

const app = name => ({get_name: () => name, get_id: () => `${name}.desktop`});

test('invalidated cache builds once and refreshes after invalidation', () => {
    let builds = 0;
    const cache = createInvalidatedCache(() => ({generation: ++builds}));

    const first = cache.get();
    assert.equal(cache.get(), first);
    assert.equal(builds, 1);

    cache.invalidate();
    const second = cache.get();
    assert.notEqual(second, first);
    assert.equal(second.generation, 2);
});

test('usage rank cache reuses ordering while usage IDs remain unchanged', () => {
    const apps = [app('Terminal'), app('Firefox'), app('Files')];
    const cache = createUsageRankCache();

    const first = cache.get(apps, [apps[1], apps[2]]);
    const second = cache.get(apps, [apps[1], apps[2]]);

    assert.equal(second, first);
    assert.deepEqual(second.map(item => item.get_name()), ['Firefox', 'Files', 'Terminal']);
});

test('usage rank cache refreshes when usage order or app snapshot changes', () => {
    const apps = [app('Terminal'), app('Firefox'), app('Files')];
    const cache = createUsageRankCache();
    const first = cache.get(apps, [apps[1], apps[2]]);

    const changedUsage = cache.get(apps, [apps[2], apps[1]]);
    assert.notEqual(changedUsage, first);
    assert.deepEqual(changedUsage.map(item => item.get_name()), ['Files', 'Firefox', 'Terminal']);

    const changedApps = [...apps];
    const changedSnapshot = cache.get(changedApps, [apps[2], apps[1]]);
    assert.notEqual(changedSnapshot, changedUsage);

    cache.clear();
    assert.notEqual(cache.get(changedApps, [apps[2], apps[1]]), changedSnapshot);
});
