// SPDX-License-Identifier: GPL-2.0-or-later

// Clipboard search creates lightweight result wrappers around history entries.
// Key preview content by the shared GLib.Bytes object so wrappers still reuse it.
const previewContentCache = new WeakMap();

/** Lazily create and reuse preview content for the same retained image bytes. */
export function getOrCreatePreviewContent(entry, create) {
    const key = entry.bytes ?? entry;
    let content = previewContentCache.get(key);
    if (!content) {
        content = create();
        previewContentCache.set(key, content);
    }
    return content;
}

/** Release cached preview content when its history entry is removed. */
export function releasePreviewContent(entry) {
    if (entry)
        previewContentCache.delete(entry.bytes ?? entry);
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
