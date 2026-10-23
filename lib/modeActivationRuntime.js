// SPDX-License-Identifier: GPL-2.0-or-later

import * as ClipboardHistory from './clipboardHistory.js';
import {openFile, openWebSearch, openRecentFile, activateWindow, openSettingsPanel} from './modes.js';
import {activateModeResult} from './modeActivation.js';

/** Connect shared result activation to a live launcher dialog. */
export function activateModeResultForDialog(dialog, item) {
    return activateModeResult(item, {
        openFile,
        restoreClipboard: ClipboardHistory.restoreEntry,
        copyText: ClipboardHistory.copyToClipboard,
        openWebSearch: query => openWebSearch(query, dialog._settings.get_string('search-url-template')),
        openRecentFile,
        activateWindow,
        openSettingsPanel,
        close: () => dialog.close(),
    });
}
