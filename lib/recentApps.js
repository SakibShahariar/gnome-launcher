// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * Keep GNOME Shell's usage-ranked app objects in usage order, excluding
 * duplicates and hidden desktop entries. Dependency-free for unit tests.
 */
export function resolveRecentApps(apps, limit = 8) {
    if (!Array.isArray(apps))
        return [];
    const maxItems = Number.isInteger(limit) && limit > 0 ? limit : 0;
    if (maxItems === 0)
        return [];

    const seen = new Set();
    const results = [];
    for (const app of apps) {
        if (!app || typeof app.get_id !== 'function')
            continue;
        const id = app.get_id();
        if (typeof id !== 'string' || !id || seen.has(id))
            continue;
        seen.add(id);
        try {
            if (app.get_app_info?.()?.get_nodisplay?.())
                continue;
        } catch {
            // Keep an otherwise valid Shell.App if optional metadata is unavailable.
        }
        results.push(app);
        if (results.length >= maxItems)
            break;
    }
    return results;
}
