// SPDX-License-Identifier: GPL-2.0-or-later

// Discovers installed applications via Shell.AppSystem and provides fuzzy
// search over them. This is the GJS equivalent of the standalone app's
// apps.py - same fuzzy-match algorithm, ported from Python.

import Shell from 'gi://Shell';

/** Returns every visible, launchable installed application as Shell.App. */
export function listApps() {
    const appSystem = Shell.AppSystem.get_default();
    return appSystem
        .get_installed()
        .filter(info => !info.get_nodisplay() && info.should_show())
        .map(info => appSystem.lookup_app(info.get_id()))
        .filter(app => app !== null)
        .sort((a, b) => a.get_name().localeCompare(b.get_name()));
}

/**
 * Subsequence fuzzy match. Returns null if query isn't a subsequence of
 * target; otherwise a score where lower is a better match. Prefix and
 * substring matches score best, followed by typo-tolerant subsequence
 * matches ranked by how spread-out the matched characters are.
 */
function fuzzyScore(query, target) {
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

/** Filter and rank apps by fuzzy match against the query. */
export function search(apps, query) {
    if (!query || !query.trim())
        return apps;

    const scored = [];
    for (const app of apps) {
        const score = fuzzyScore(query, app.get_name());
        if (score !== null)
            scored.push([score, app]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].get_name().localeCompare(b[1].get_name()));
    return scored.map(pair => pair[1]);
}
