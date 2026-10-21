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

import {fuzzySearch, rankAppsByUsage} from './fuzzySearch.js';

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
    if (!trimmed) {
        try {
            return rankAppsByUsage(apps, Shell.AppUsage.get_default().get_most_used(''));
        } catch (e) {
            log(`gnome-launcher: app usage ranking unavailable (${e}); using alphabetical order`);
            return apps;
        }
    }

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
