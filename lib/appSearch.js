// SPDX-License-Identifier: GPL-2.0-or-later

// Discovers installed applications, and searches them using GNOME's real
// AppSearchProvider (the exact class Activities' own overview search
// uses) when it's available - falling back to a hand-rolled fuzzy
// matcher if importing/instantiating/calling it fails for any reason.
//
// This is a second attempt at native search after Shell.AppSystem's
// convenience method (initial_search) turned out not to exist on
// current GNOME (confirmed via journalctl - real error, not a guess).
// This time importing the actual UI class directly. NOT verified against
// a live Shell session - every step below is wrapped defensively so a
// failure anywhere in this path falls back to the fuzzy matcher rather
// than breaking search again.

import Shell from 'gi://Shell';

const appSystem = Shell.AppSystem.get_default();

let nativeProvider = null;
try {
    const AppDisplay = await import('resource:///org/gnome/shell/ui/appDisplay.js');
    if (AppDisplay.AppSearchProvider) {
        nativeProvider = new AppDisplay.AppSearchProvider();
        log('gnome-launcher: native AppSearchProvider loaded successfully');
    } else {
        log('gnome-launcher: appDisplay.js has no exported AppSearchProvider, using fuzzy fallback');
    }
} catch (e) {
    log(`gnome-launcher: failed to load native AppSearchProvider (${e}), using fuzzy fallback`);
}

/** Returns every visible, launchable installed application as Shell.App. */
export function listApps() {
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

function fuzzySearch(apps, query) {
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
 * Search apps, trying native GNOME search first and falling back to the
 * fuzzy matcher on any failure. Now async (GNOME's real search providers
 * are async, returning result-ID Promises) - callers must await this.
 *
 * @param {Gio.Cancellable} [cancellable] - cancelled by the caller when a
 *   newer keystroke supersedes this search, so a stale native search
 *   result doesn't overwrite a more recent one.
 */
export async function search(apps, query, cancellable) {
    const trimmed = query.trim();
    if (!trimmed)
        return apps;

    if (nativeProvider) {
        try {
            const terms = trimmed.split(/\s+/).filter(term => term.length > 0);
            const resultIds = await nativeProvider.getInitialResultSet(terms, cancellable);
            const results = resultIds
                .map(id => appSystem.lookup_app(id))
                .filter(app => app !== null);
            log(`gnome-launcher: native search "${trimmed}" -> ${results.length} results`);
            return results;
        } catch (e) {
            log(`gnome-launcher: native search failed at runtime (${e}), using fuzzy fallback for this query`);
            // Falls through to fuzzySearch below.
        }
    }

    return fuzzySearch(apps, trimmed);
}
