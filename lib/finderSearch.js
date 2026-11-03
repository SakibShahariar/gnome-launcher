// SPDX-License-Identifier: GPL-2.0-or-later

/** Resolve a finder query using injected desktop services. */
export async function searchFinderResults(mode, query, dependencies, cancellable = null) {
    if (cancellable?.is_cancelled())
        return [];

    if (mode === 'run') {
        const command = query.trim();
        return command ? [{kind: 'run', command, name: `Run: ${command}`}] : [];
    }

    if (mode === 'power') {
        const normalized = query.trim().toLowerCase();
        return (dependencies.powerActions ?? [])
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
