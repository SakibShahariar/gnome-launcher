// SPDX-License-Identifier: GPL-2.0-or-later

// Modes offered by the switchers in Sidebar, Split Tabs, and Hero Banner.
// Applications is mandatory: it is the fallback when every other mode is
// hidden or when the configured default mode is not visible.
export const MODE_OPTIONS = [
    {id: 'apps', label: 'Applications'},
    {id: 'run', label: 'Run a command'},
    {id: 'files', label: 'Search files'},
    {id: 'window', label: 'Switch windows'},
    {id: 'clipboard', label: 'Clipboard history'},
    {id: 'calculator', label: 'Calculate'},
    {id: 'web', label: 'Search the web'},
    {id: 'recent', label: 'Recent documents'},
    {id: 'emoji', label: 'Search emoji'},
    {id: 'settings', label: 'GNOME Settings'},
    {id: 'power', label: 'Power actions'},
];

const ALL_IDS = MODE_OPTIONS.map(option => option.id);

/** Return a safe, deduplicated list that always contains 'apps'. */
export function normalizeVisibleModes(value) {
    const ids = Array.isArray(value)
        ? [...new Set(value.filter(id => ALL_IDS.includes(id)))]
        : [];
    return ids.includes('apps') ? ids : ['apps', ...ids];
}

/** Filter a layout's mode definitions down to the user's visible modes. */
export function filterModes(modes, visibleModes) {
    const enabled = new Set(normalizeVisibleModes(visibleModes));
    return modes.filter(([modeId]) => enabled.has(modeId));
}
