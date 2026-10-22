// SPDX-License-Identifier: GPL-2.0-or-later

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {LauncherDialog} from './lib/launcherDialog.js';
import {ShortcutCheatsheet} from './lib/shortcutCheatsheet.js';
import * as ClipboardHistory from './lib/clipboardHistory.js';
import {cleanupSearchProvider, initializeSearchProvider} from './lib/appSearch.js';

export default class GnomeLauncherExtension extends Extension {
    enable() {
        initializeSearchProvider();
        this._settings = this.getSettings();
        this._dialog = null;
        this._cheatsheet = null;

        this._clipboardHistorySignalId = this._settings.connect(
            'changed::clipboard-history-enabled',
            () => this._syncClipboardHistory()
        );
        this._clipboardHistoryClearSignalId = this._settings.connect(
            'changed::clipboard-history-clear-request',
            () => ClipboardHistory.clearHistory()
        );
        this._syncClipboardHistory();

        Main.wm.addKeybinding(
            'toggle-launcher',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._toggle()
        );
        Main.wm.addKeybinding(
            'toggle-shortcuts-cheatsheet',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._toggleCheatsheet()
        );
    }

    disable() {
        Main.wm.removeKeybinding('toggle-launcher');
        Main.wm.removeKeybinding('toggle-shortcuts-cheatsheet');
        if (this._clipboardHistorySignalId) {
            this._settings.disconnect(this._clipboardHistorySignalId);
            this._clipboardHistorySignalId = 0;
        }
        if (this._clipboardHistoryClearSignalId) {
            this._settings.disconnect(this._clipboardHistoryClearSignalId);
            this._clipboardHistoryClearSignalId = 0;
        }
        ClipboardHistory.stopTracking();
        cleanupSearchProvider();
        this._dialog?.close();
        this._dialog = null;
        this._cheatsheet?.close();
        this._cheatsheet = null;
        this._settings = null;
    }

    _syncClipboardHistory() {
        if (this._settings?.get_boolean('clipboard-history-enabled'))
            ClipboardHistory.startTracking();
        else
            ClipboardHistory.stopTracking();
    }

    _toggle() {
        if (this._dialog) {
            this._dialog.close();
            this._dialog = null;
            return;
        }
        const dialog = new LauncherDialog(this._settings);
        this._dialog = dialog;
        dialog.connect('closed', () => {
            // Closing animations may finish after a newer dialog has opened.
            // A stale close signal must not clear the current dialog reference.
            if (this._dialog === dialog)
                this._dialog = null;
        });
        dialog.open();
    }

    _toggleCheatsheet() {
        if (this._cheatsheet) {
            this._cheatsheet.close();
            this._cheatsheet = null;
            return;
        }

        if (this._dialog) {
            this._dialog.close();
            this._dialog = null;
        }

        const dialog = new ShortcutCheatsheet();
        this._cheatsheet = dialog;
        dialog.connect('closed', () => {
            if (this._cheatsheet === dialog)
                this._cheatsheet = null;
        });
        dialog.open();
    }
}
