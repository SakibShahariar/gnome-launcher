// SPDX-License-Identifier: GPL-2.0-or-later

const previewContentCache = new WeakMap();

/** Lazily create and reuse preview content for the same history entry. */
export function getOrCreatePreviewContent(entry, create) {
    let content = previewContentCache.get(entry);
    if (!content) {
        content = create();
        previewContentCache.set(entry, content);
    }
    return content;
}

/** Release cached preview content when its history entry is removed. */
export function releasePreviewContent(entry) {
    if (entry) {
        previewContentCache.delete(entry);
        entry.preview = null;
    }
}

/**
 * Retain original image payloads newest-first within a total memory budget.
 * Preview pixbufs and entry metadata remain available after original bytes are
 * released, so older images can still be browsed but not restored.
 */
export function enforceImageByteBudget(history, maxBytes) {
    let retainedBytes = 0;
    for (const entry of history) {
        if (entry?.kind !== 'image' || !entry.bytes)
            continue;

        const size = entry.bytes.get_size();
        if (!Number.isSafeInteger(size) || size <= 0 || retainedBytes + size > maxBytes) {
            entry.bytes = null;
            continue;
        }
        retainedBytes += size;
    }
    return retainedBytes;
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
        removed.forEach(entry => {
            releasePreviewContent(entry);
            entry.bytes = null;
        });
    }

    return history;
}
