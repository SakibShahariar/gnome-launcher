// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * Resolve the shared query-backed modes used by Sidebar, Split Tabs, and
 * Hero Banner. Layout-specific rendering and activation remain in each view.
 */
export function searchModeResults(mode, query, {
    searchEmoji,
    searchRecentFiles,
    evaluateCalculatorInput,
    listOpenWindows,
    allWorkspaces = false,
    searchSettingsPanels,
}) {
    if (mode === 'emoji') {
        return searchEmoji(query).map(item => ({
            ...item,
            name: `${item.emoji} ${item.name}`,
            kind: 'emoji',
        }));
    }

    if (mode === 'recent')
        return searchRecentFiles(query).map(item => ({...item, kind: 'recent'}));

    if (mode === 'web') {
        const trimmed = query.trim();
        return trimmed
            ? [{name: `Search the web for “${trimmed}”`, query: trimmed, kind: 'web'}]
            : [];
    }

    if (mode === 'calculator') {
        const calculation = evaluateCalculatorInput(query);
        return calculation ? [{
            name: calculation.value === null
                ? `${query.trim()} — ${calculation.display}`
                : `${query.trim()} = ${calculation.display}`,
            value: calculation.value,
            copyable: calculation.copyable,
            kind: 'calculator',
        }] : [];
    }

    if (mode === 'window') {
        const normalized = query.trim().toLowerCase();
        return listOpenWindows(allWorkspaces)
            .filter(win => !normalized || win.name.toLowerCase().includes(normalized))
            .map(win => ({...win, kind: 'window'}));
    }

    if (mode === 'settings')
        return searchSettingsPanels(query);

    return null;
}
