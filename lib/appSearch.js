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

import {fuzzySearch, rankAppsByUsage, resolveSearchResults} from './fuzzySearch.js';

const appSystem = Shell.AppSystem.get_default();

let NativeProviderClass = null;
let nativeProvider = null;

try {
    const AppDisplay = await import('resource:///org/gnome/shell/ui/appDisplay.js');
    NativeProviderClass = AppDisplay.AppSearchProvider ?? null;
    if (!NativeProviderClass)
        log('gnome-launcher: appDisplay.js has no exported AppSearchProvider, using fuzzy fallback');
} catch (e) {
    log(`gnome-launcher: failed to load native AppSearchProvider (${e}), using fuzzy fallback`);
}

/** Create the native provider for the current extension enable lifecycle. */
export function initializeSearchProvider() {
    if (nativeProvider || !NativeProviderClass)
        return;

    try {
        nativeProvider = new NativeProviderClass();
        log('gnome-launcher: native AppSearchProvider initialized');
    } catch (e) {
        nativeProvider = null;
        log(`gnome-launcher: failed to initialize native AppSearchProvider (${e}), using fuzzy fallback`);
    }
}

/** Drop the provider reference when the extension is disabled. */
export function cleanupSearchProvider() {
    nativeProvider = null;
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
            const results = resolveSearchResults(apps, resultIds);
            if (results.length > 0) {
                log(`gnome-launcher: native search "${trimmed}" -> ${results.length} results`);
                return results;
            }
            // Native providers can return IDs that don't resolve to visible
            // apps, or no IDs for a query the local matcher can still satisfy.
            // Keep search useful rather than presenting a false empty state.
            log(`gnome-launcher: native search "${trimmed}" returned no launchable results; using fuzzy fallback`);
        } catch (e) {
            log(`gnome-launcher: native search failed at runtime (${e}), using fuzzy fallback for this query`);
            // Falls through to fuzzySearch below.
        }
    }

    return fuzzySearch(apps, trimmed);
}
