// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * Map items with a bounded number of concurrent asynchronous operations.
 * Results stay in input order even when individual operations finish out of order.
 */
export async function mapWithConcurrency(items, concurrency, mapper, shouldStop = () => false) {
    const workerCount = Math.min(items.length, Math.max(1, Math.floor(concurrency) || 1));
    const results = new Array(items.length);
    let nextIndex = 0;

    const worker = async () => {
        while (!shouldStop()) {
            const index = nextIndex++;
            if (index >= items.length)
                return;
            results[index] = await mapper(items[index], index);
        }
    };

    await Promise.all(Array.from({length: workerCount}, () => worker()));
    return results;
}
