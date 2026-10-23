// SPDX-License-Identifier: GPL-2.0-or-later

import {parseFinderPrefix} from './finderPrefix.js';

/**
 * Apply a recognized finder prefix to a mode-based layout.
 * Layouts provide their own mode metadata and switching implementation;
 * prefix parsing and query hand-off stay consistent across all of them.
 */
export function cancelAppSearch(dialog) {
    if (!dialog?._searchCancellable)
        return;
    dialog._searchCancellable.cancel();
    dialog._searchCancellable = null;
}

export function applyFinderPrefix(layout, text, modeDefinitions) {
    const prefix = parseFinderPrefix(text);
    if (!prefix || !modeDefinitions.some(mode => mode[0] === prefix.mode))
        return false;

    if (prefix.mode !== 'apps')
        cancelAppSearch(layout.dialog);

    if (layout.mode !== prefix.mode)
        layout._switchMode(prefix.mode);
    if (layout.entry.get_text() !== prefix.query)
        layout.entry.set_text(prefix.query);
    return true;
}
