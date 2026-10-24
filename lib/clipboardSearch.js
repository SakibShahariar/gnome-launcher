// SPDX-License-Identifier: GPL-2.0-or-later

/** Filter clipboard entries consistently across mode layouts. */
export function searchClipboardEntries(entries, query = '', enabled = true) {
    if (!enabled || !Array.isArray(entries))
        return [];

    const normalized = typeof query === 'string' ? query.trim().toLowerCase() : '';
    return entries
        .filter(entry => entry && typeof entry === 'object' &&
            typeof entry.name === 'string' &&
            (!normalized || entry.name.toLowerCase().includes(normalized)))
        .map(entry => ({
            ...entry,
            kind: entry.kind === 'image' ? 'clipboard-image' : 'clipboard',
        }));
}
