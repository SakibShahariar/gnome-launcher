// SPDX-License-Identifier: GPL-2.0-or-later

import {searchEmoji} from './emojiFinder.js';
import {evaluateCalculatorInput} from './calculator.js';
import {listOpenWindows, searchRecentFiles, searchSettingsPanels} from './modes.js';

/** Build the live dependencies shared by every mode-based layout. */
export function createModeSearchDependencies(dialog) {
    return {
        searchEmoji,
        searchRecentFiles,
        evaluateCalculatorInput,
        listOpenWindows,
        allWorkspaces: dialog._settings.get_boolean('windows-all-workspaces'),
        searchSettingsPanels,
    };
}
