// SPDX-License-Identifier: GPL-2.0-or-later

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ClipboardHistory from './clipboardHistory.js';
import {openFile, openWebSearch, openRecentFile, activateWindow, openSettingsPanel} from './modes.js';
import {pickScreenColor} from './colorPicker.js';
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
        closeAndPickScreenColor: () => {
            dialog.connect('closed', () => {
                pickScreenColor({
                    onPicked: hex => {
                        ClipboardHistory.copyToClipboard(hex);
                        Main.notify('GNOME Launcher', `Copied ${hex} to clipboard.`);
                    },
                    onError: error => {
                        log(`gnome-launcher: screen color picker unavailable: ${error}`);
                        Main.notify(
                            'GNOME Launcher',
                            'Screen color picking is unavailable on this desktop. Check its screenshot portal support.'
                        );
                    },
                });
            });
            dialog.close();
        },
    });
}
