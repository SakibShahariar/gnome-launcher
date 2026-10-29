// SPDX-License-Identifier: GPL-2.0-or-later

import {FINDERS} from './finderPrefix.js';

// Keep the preference tied to the same registry used by Spotlight prefix
// parsing. The registry contains only modes shared by all mode-based layouts.
export function resolveDefaultMode(mode) {
    return FINDERS.get(mode) ? mode : 'apps';
}
