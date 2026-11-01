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
        .map(entry => {
            const isImage = entry.kind === 'image';
            const result = {
                ...entry,
                kind: isImage ? 'clipboard-image' : 'clipboard',
            };
            // Keep the original entry as the owner of image bytes and cached
            // preview content. Search results must not extend byte lifetimes.
            delete result.bytes;
            delete result.preview;
            Object.defineProperty(result, '_historyEntry', {value: entry});
            if (isImage && !entry.bytes)
                result.name = `${entry.name} (preview only)`;
            return result;
        });
}
