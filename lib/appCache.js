// SPDX-License-Identifier: GPL-2.0-or-later

import {rankAppsByUsage} from './fuzzySearch.js';

/** Cache a value until its owner explicitly invalidates it. */
export function createInvalidatedCache(build) {
    let value = null;

    return {
        get() {
            if (value === null)
                value = build();
            return value;
        },
        invalidate() {
            value = null;
        },
    };
}

/**
 * Cache usage-ranked apps while checking the current usage order on each
 * empty query. AppUsage exposes no usage-change signal, so comparing IDs
 * keeps the cache fresh without sorting the full app list every time.
 */
export function createUsageRankCache() {
    let cachedApps = null;
    let cachedUsageIds = null;
    let cachedResults = null;

    return {
        get(apps, mostUsed) {
            const usageIds = mostUsed.map(app => app.get_id());
            const usageOrderUnchanged = cachedUsageIds !== null &&
                usageIds.length === cachedUsageIds.length &&
                usageIds.every((id, index) => id === cachedUsageIds[index]);

            if (cachedApps !== apps || !usageOrderUnchanged) {
                cachedApps = apps;
                cachedUsageIds = usageIds;
                cachedResults = rankAppsByUsage(apps, mostUsed);
            }

            return cachedResults;
        },
        clear() {
            cachedApps = null;
            cachedUsageIds = null;
            cachedResults = null;
        },
    };
}
