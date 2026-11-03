// SPDX-License-Identifier: GPL-2.0-or-later

/** Keep the persisted pin list ordered, unique, and limited to desktop IDs. */
export function normalizePinnedAppIds(ids) {
    if (!Array.isArray(ids))
        return [];

    const seen = new Set();
    return ids.filter(id => {
        if (typeof id !== 'string' || id.length === 0 || id.trim() !== id || seen.has(id))
            return false;
        seen.add(id);
        return true;
    });
}

/** Toggle an application ID while preserving the order of all other pins. */
export function togglePinnedAppId(ids, appId) {
    const pinned = normalizePinnedAppIds(ids);
    if (typeof appId !== 'string' || appId.length === 0)
        return pinned;

    return pinned.includes(appId)
        ? pinned.filter(id => id !== appId)
        : [...pinned, appId];
}

/** Resolve saved IDs to currently installed apps without rewriting stale IDs. */
export function getPinnedApps(apps, pinnedIds) {
    const byId = new Map();
    for (const app of apps) {
        const id = app?.get_id?.();
        if (id && !byId.has(id))
            byId.set(id, app);
    }

    return normalizePinnedAppIds(pinnedIds)
        .map(id => byId.get(id))
        .filter(Boolean);
}

/**
 * Put pinned apps first in saved order, then retain the search provider's
 * original ranking for every remaining result. Missing IDs are ignored and
 * matching pins are never duplicated.
 */
export function orderAppsWithPinnedFirst(apps, pinnedIds, results = apps) {
    const pinned = getPinnedApps(apps, pinnedIds);
    const seen = new Set(pinned.map(app => app.get_id()));
    const ordinary = [];

    for (const app of results) {
        const id = app?.get_id?.();
        if (!id || seen.has(id))
            continue;
        seen.add(id);
        ordinary.push(app);
    }

    return [...pinned, ...ordinary];
}
