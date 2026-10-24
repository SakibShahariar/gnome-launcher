// SPDX-License-Identifier: GPL-2.0-or-later

// Informational microbenchmark; intentionally has no timing threshold because
// shared CI runners are noisy. The baseline mirrors the previous per-app
// query normalization and repeated get_name() calls for comparison.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';

import {createSearchResultResolver, fuzzySearch, resolveSearchResults} from '../lib/fuzzySearch.js';

const SIZES = [100, 500, 1000, 5000];
const QUERIES = ['fi', 'settings', 'term', 'firefox'];
const WARMUP_RUNS = 5;
const MEASURED_RUNS = 25;

function legacyFuzzyScore(query, target) {
    const normalizedQuery = query.toLowerCase();
    const normalizedTarget = target.toLowerCase();
    if (!normalizedQuery)
        return 0;

    const idx = normalizedTarget.indexOf(normalizedQuery);
    if (idx !== -1)
        return normalizedTarget.startsWith(normalizedQuery) ? 0 : idx + 1;

    let tIdx = 0;
    let first = -1;
    let last = -1;
    for (const ch of normalizedQuery) {
        const found = normalizedTarget.indexOf(ch, tIdx);
        if (found === -1)
            return null;
        if (first === -1)
            first = found;
        last = found;
        tIdx = found + 1;
    }
    return 1000 + (last - first);
}

function legacyFuzzySearch(apps, query) {
    const scored = [];
    for (const app of apps) {
        const score = legacyFuzzyScore(query, app.get_name());
        if (score !== null)
            scored.push([score, app]);
    }
    scored.sort((a, b) => a[0] - b[0] ||
        a[1].get_name().localeCompare(b[1].get_name()));
    return scored.map(pair => pair[1]);
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
}

function makeApps(size) {
    const prefixes = ['Firefox Utility', 'File Manager', 'System Settings', 'Terminal', 'Text Editor'];
    return Array.from({length: size}, (_, index) => {
        const name = `${prefixes[index % prefixes.length]} ${String(index).padStart(5, '0')}`;
        return {get_name: () => name, get_id: () => `app-${index}.desktop`};
    });
}

function measure(search, apps) {
    const run = () => {
        for (const query of QUERIES)
            search(apps, query);
    };

    for (let i = 0; i < WARMUP_RUNS; i++)
        run();

    const samples = [];
    for (let i = 0; i < MEASURED_RUNS; i++) {
        const start = performance.now();
        run();
        samples.push(performance.now() - start);
    }
    return {
        median: median(samples),
        min: Math.min(...samples),
        max: Math.max(...samples),
    };
}

console.log('apps,queries,baseline_median_ms,optimized_median_ms,speedup');
for (const size of SIZES) {
    const apps = makeApps(size);
    for (const query of QUERIES) {
        assert.deepEqual(
            fuzzySearch(apps, query).map(app => app.get_id()),
            legacyFuzzySearch(apps, query).map(app => app.get_id()),
            `search ranking changed for ${size} apps and query "${query}"`
        );
    }
    const baseline = measure(legacyFuzzySearch, apps);
    const optimized = measure(fuzzySearch, apps);
    console.log([
        size,
        QUERIES.length,
        baseline.median.toFixed(3),
        optimized.median.toFixed(3),
        (baseline.median / Math.max(optimized.median, 0.001)).toFixed(2),
    ].join(','));
}

function measureMapping(operation) {
    const iterations = 100;
    const run = () => {
        for (let i = 0; i < iterations; i++)
            operation();
    };
    for (let i = 0; i < WARMUP_RUNS; i++)
        run();
    const samples = [];
    for (let i = 0; i < MEASURED_RUNS; i++) {
        const start = performance.now();
        run();
        samples.push((performance.now() - start) / iterations);
    }
    return median(samples);
}

console.log('apps,result_ids,baseline_mapping_median_ms,cached_mapping_median_ms,speedup');
for (const size of SIZES) {
    const apps = makeApps(size);
    const resultIds = apps.slice(0, Math.min(20, size)).map(app => app.get_id());
    const resolver = createSearchResultResolver(apps);
    assert.deepEqual(
        resolver(resultIds).map(app => app.get_id()),
        resolveSearchResults(apps, resultIds).map(app => app.get_id()),
        `cached result mapping changed order for ${size} apps`
    );
    const baseline = measureMapping(() => resolveSearchResults(apps, resultIds));
    const optimized = measureMapping(() => resolver(resultIds));
    console.log([
        size,
        resultIds.length,
        baseline.toFixed(4),
        optimized.toFixed(4),
        (baseline / Math.max(optimized, 0.0001)).toFixed(2),
    ].join(','));
}
