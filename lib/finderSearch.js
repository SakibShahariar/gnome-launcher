// SPDX-License-Identifier: GPL-2.0-or-later

/** Resolve a finder query using injected desktop services. */
export async function searchFinderResults(mode, query, dependencies, cancellable = null) {
    if (cancellable?.is_cancelled())
        return [];

    if (mode === 'color')
        return [{kind: 'color', name: 'Pick a color from the screen'}];

    if (mode === 'run') {
        const command = query.trim();
        return command ? [{kind: 'run', command, name: `Run: ${command}`}] : [];
    }

    if (mode === 'power') {
        const normalized = query.trim().toLowerCase();
        return (dependencies.powerActions ?? [])
            // Spotlight exposes only non-destructive actions; system-wide
            // power-off, restart, and logout remain in material-system-actions.
            .filter(action => ['lock', 'suspend'].includes(action.id))
            .filter(action => !normalized || action.name.toLowerCase().includes(normalized))
            .map(action => ({...action, kind: 'power'}));
    }

    if (mode === 'files') {
        const results = await dependencies.searchFiles(query, cancellable);
        if (cancellable?.is_cancelled())
            return [];
        return results.map(item => ({...item, kind: 'file'}));
    }

    if (mode === 'clipboard') {
        return dependencies.searchClipboardEntries(
            dependencies.clipboardEntries,
            query,
            dependencies.clipboardEnabled
        );
    }

    return dependencies.searchModeResults(mode, query, dependencies);
}


/** Return a bounded result slice that always contains the selected index. */
export function getFinderResultWindow(total, selectedIndex, limit = 12) {
    if (!Number.isInteger(total) || total <= 0)
        return {start: 0, end: 0};
    const size = Number.isInteger(limit) && limit > 0 ? Math.min(limit, total) : total;
    const selected = Number.isInteger(selectedIndex)
        ? Math.max(0, Math.min(selectedIndex, total - 1))
        : 0;
    const start = Math.max(0, Math.min(selected - size + 1, total - size));
    return {start, end: start + size};
}
