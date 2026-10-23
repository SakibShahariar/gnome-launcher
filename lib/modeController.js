// SPDX-License-Identifier: GPL-2.0-or-later

import {cancelAppSearch} from './finderPrefixController.js';

/**
 * Reset state shared by the three mode-based layouts before they update
 * their layout-specific mode controls and populate the selected mode.
 */
export function resetModeState(layout, modeId) {
    cancelAppSearch(layout.dialog);
    layout._cancelFileSearch?.();
    if ('_pendingPowerActionId' in layout)
        layout._pendingPowerActionId = null;

    layout.mode = modeId;
    layout._modeResults = [];
    layout._modeSelectedIndex = 0;
    if ('_windowStart' in layout)
        layout._windowStart = 0;
    if ('_modeWindowStart' in layout)
        layout._modeWindowStart = 0;
}
