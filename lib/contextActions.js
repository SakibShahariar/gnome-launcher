// SPDX-License-Identifier: GPL-2.0-or-later

// Pure action-provider logic. Only actions that are safe and supported are
// advertised; apps keep using the existing shared desktop-action menu.

/** Convert a local file result to a filesystem path when possible. */
export function filePathFromItem(item) {
    if (!item || item.kind !== 'file')
        return null;
    if (typeof item.path === 'string' && item.path.length > 0)
        return item.path;
    if (typeof item.uri === 'string' && item.uri.startsWith('file://')) {
        try {
            return decodeURIComponent(item.uri.slice('file://'.length));
        } catch {
            return item.uri.slice('file://'.length);
        }
    }
    return null;
}

/** Return the contextual actions supported by a result, in display order. */
export function getContextActions(item) {
    const path = filePathFromItem(item);
    if (!path)
        return [];
    return [
        {id: 'copy-path', label: 'Copy full path'},
        {id: 'open-folder', label: 'Open containing folder'},
    ];
}
