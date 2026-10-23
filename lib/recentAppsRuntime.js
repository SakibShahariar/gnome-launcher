// SPDX-License-Identifier: GPL-2.0-or-later

import Shell from 'gi://Shell';

import {resolveRecentApps} from './recentApps.js';

/** Read GNOME Shell's usage-ranked apps without maintaining separate history. */
export function getRecentApps(limit = 8) {
    try {
        return resolveRecentApps(Shell.AppUsage.get_default().get_most_used(''), limit);
    } catch (e) {
        log(`gnome-launcher: recent apps are unavailable: ${e}`);
        return [];
    }
}
