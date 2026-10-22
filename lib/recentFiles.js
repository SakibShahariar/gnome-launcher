// SPDX-License-Identifier: GPL-2.0-or-later

const MAX_RECENT_RESULTS = 20;

/** Filter already-read system recent items without persisting any extra data. */
export function filterRecentFiles(items, query = '', limit = MAX_RECENT_RESULTS) {
    if (!Array.isArray(items) || !Number.isInteger(limit) || limit < 1)
        return [];

    const normalized = typeof query === 'string' ? query.trim().toLowerCase() : '';
    return items
        .filter(item => item && typeof item.name === 'string' && typeof item.uri === 'string')
        .filter(item => !normalized ||
            item.name.toLowerCase().includes(normalized) ||
            item.uri.toLowerCase().includes(normalized))
        .sort((a, b) => (Number(b.modified) || 0) - (Number(a.modified) || 0))
        .slice(0, Math.min(limit, MAX_RECENT_RESULTS));
}
