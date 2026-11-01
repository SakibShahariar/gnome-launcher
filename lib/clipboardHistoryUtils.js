// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * Lazily create and retain a preview content object on its history entry.
 * The entry owns the object, so it can be released with the entry lifecycle.
 */
export function getOrCreatePreviewContent(entry, create) {
    if (!entry.previewContent)
        entry.previewContent = create();
    return entry.previewContent;
}

/** Release cached preview content when its history entry is removed. */
export function releasePreviewContent(entry) {
    if (entry)
        entry.previewContent = null;
}

/**
 * Move a text entry to the front of clipboard history without rebuilding the
 * array. Existing entries are mutated in place so callers keep the same list.
 */
export function rememberTextEntry(history, text, timestamp, maxHistory) {
    const duplicateIndex = history.findIndex(
        item => item.kind === 'text' && item.text === text
    );
    if (duplicateIndex !== -1)
        history.splice(duplicateIndex, 1);

    history.unshift({kind: 'text', name: text, text, timestamp});
    if (history.length > maxHistory) {
        const removed = history.splice(maxHistory);
        removed.forEach(releasePreviewContent);
    }

    return history;
}
