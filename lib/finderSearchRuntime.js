// SPDX-License-Identifier: GPL-2.0-or-later

import {searchFinderResults as resolveFinderResults} from './finderSearch.js';
import {searchClipboardEntries} from './clipboardSearch.js';

/** Bind the generic finder resolver to GNOME Shell services. */
export function searchFinderResults(mode, query, dependencies, cancellable) {
    return resolveFinderResults(mode, query, {
        ...dependencies,
        searchClipboardEntries,
    }, cancellable);
}
