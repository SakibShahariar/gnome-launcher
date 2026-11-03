// SPDX-License-Identifier: GPL-2.0-or-later

import {FINDERS} from './finderPrefix.js';

// Prefix-only finders are available in every layout but are not all exposed
// as default modes by the three layouts with persistent mode switchers.
export function resolveDefaultMode(mode) {
    const finder = FINDERS.get(mode);
    return finder && finder.defaultMode !== false ? mode : 'apps';
}
