// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * Subsequence fuzzy match. Returns null if query isn't a subsequence of
 * target; otherwise a score where lower is a better match. Prefix and
 * substring matches score best, followed by typo-tolerant subsequence
 * matches ranked by how spread-out the matched characters are.
 */
export function fuzzyScore(query, target) {
    query = query.toLowerCase();
    target = target.toLowerCase();
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

export function fuzzySearch(apps, query) {
    const scored = [];
    for (const app of apps) {
        const score = fuzzyScore(query, app.get_name());
        if (score !== null)
            scored.push([score, app]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].get_name().localeCompare(b[1].get_name()));
    return scored.map(pair => pair[1]);
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
