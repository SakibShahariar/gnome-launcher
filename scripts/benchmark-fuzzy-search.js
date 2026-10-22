// SPDX-License-Identifier: GPL-2.0-or-later

// Informational microbenchmark for local profiling; deliberately has no
// timing threshold because shared CI runners are noisy.
import {performance} from 'node:perf_hooks';

import {fuzzySearch} from '../lib/fuzzySearch.js';

const SIZES = [100, 500, 1000, 5000];
const QUERIES = ['fi', 'settings', 'term', 'firefox'];
const WARMUP_RUNS = 5;
const MEASURED_RUNS = 25;

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
        ? sorted[middle]
        : (sorted[middle - 1] + sorted[middle]) / 2;
}

function makeApps(size) {
    const fixed = ['Firefox', 'Files', 'Settings', 'Terminal', 'Text Editor'];
    return Array.from({length: size}, (_, index) => {
        const name = index < fixed.length
            ? fixed[index]
            : `Application ${String(index).padStart(5, '0')}`;
        return {get_name: () => name};
    });
}

console.log('apps,queries,median_ms,min_ms,max_ms');
for (const size of SIZES) {
    const apps = makeApps(size);
    const run = () => {
        for (const query of QUERIES)
            fuzzySearch(apps, query);
    };

    for (let i = 0; i < WARMUP_RUNS; i++)
        run();

    const samples = [];
    for (let i = 0; i < MEASURED_RUNS; i++) {
        const start = performance.now();
        run();
        samples.push(performance.now() - start);
    }

    console.log([
        size,
        QUERIES.length,
        median(samples).toFixed(3),
        Math.min(...samples).toFixed(3),
        Math.max(...samples).toFixed(3),
    ].join(','));
}
