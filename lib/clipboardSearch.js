// SPDX-License-Identifier: GPL-2.0-or-later

/** Filter clipboard entries consistently across mode layouts. */
export function searchClipboardEntries(entries, query = '', enabled = true) {
    if (!enabled)
        return [];

    const normalized = typeof query === 'string' ? query.trim().toLowerCase() : '';
    return entries
        .filter(entry => !normalized || (entry.name || '').toLowerCase().includes(normalized))
        .map(entry => ({
            ...entry,
            kind: entry.kind === 'image' ? 'clipboard-image' : 'clipboard',
        }));
}
