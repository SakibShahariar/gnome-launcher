// SPDX-License-Identifier: GPL-2.0-or-later

// Cache normalized display names across keystrokes. The original name is kept
// beside the normalized value so app metadata/name changes invalidate entries.
const normalizedAppNames = new WeakMap();

function getNormalizedAppName(app, name) {
    const cached = normalizedAppNames.get(app);
    if (cached?.name === name)
        return cached.normalized;

    const normalized = name.toLowerCase();
    normalizedAppNames.set(app, {name, normalized});
    return normalized;
}

/**
 * Subsequence fuzzy match. Returns null if query isn't a subsequence of
 * target; otherwise a score where lower is a better match. Prefix and
 * substring matches score best, followed by typo-tolerant subsequence
 * matches ranked by how spread-out the matched characters are.
 */
function fuzzyScoreNormalized(query, target) {
    if (!query)
        return 0;

    const idx = target.indexOf(query);
    if (idx !== -1)
        return target.startsWith(query) ? 0 : idx + 1;

    let tIdx = 0;
    let first = -1;
    let last = -1;
    for (const ch of query) {
        const found = target.indexOf(ch, tIdx);
        if (found === -1)
            return null;
        if (first === -1)
            first = found;
        last = found;
        tIdx = found + 1;
    }
    return 1000 + (last - first);
}

/** Public case-insensitive score helper used by tests and other callers. */
export function fuzzyScore(query, target) {
    return fuzzyScoreNormalized(query.toLowerCase(), target.toLowerCase());
}

export function fuzzySearch(apps, query) {
    // Normalize the query once per keystroke, and cache each app's display
    // name in the scored tuple so sorting does not repeatedly call get_name().
    const normalizedQuery = query.toLowerCase();
    const scored = [];
    for (const app of apps) {
        const name = app.get_name();
        const score = fuzzyScoreNormalized(normalizedQuery, getNormalizedAppName(app, name));
        if (score !== null)
            scored.push([score, name, app]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
    return scored.map(pair => pair[2]);
}

/**
 * Rank frequently used apps first, preserving usage order. Apps without
 * usage data follow alphabetically so first-run behavior stays predictable.
 */
export function rankAppsByUsage(apps, mostUsed) {
    const ranks = new Map(mostUsed.map((app, index) => [app.get_id(), index]));
    return [...apps].sort((a, b) => {
        const rankA = ranks.get(a.get_id());
        const rankB = ranks.get(b.get_id());
        if (rankA !== undefined && rankB === undefined)
            return -1;
        if (rankA === undefined && rankB !== undefined)
            return 1;
        if (rankA !== undefined && rankB !== undefined && rankA !== rankB)
            return rankA - rankB;
        return a.get_name().localeCompare(b.get_name());
    });
}


/**
 * Resolves native search result IDs against the launchable app list.
 * Search providers may return desktop entries that the launcher deliberately
 * hides (for example, NoDisplay applications), so never trust IDs alone.
 */
export function createSearchResultResolver(apps) {
    // Build the ID index once for a stable installed-app snapshot. Native
    // search can then resolve each keystroke's result IDs without rescanning
    // every installed app.
    const appsById = new Map(apps.map(app => [app.get_id(), app]));
    return resultIds => resultIds
        .map(id => appsById.get(id))
        .filter(app => app !== undefined);
}

export function resolveSearchResults(apps, resultIds) {
    return createSearchResultResolver(apps)(resultIds);
}
