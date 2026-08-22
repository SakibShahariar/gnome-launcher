// SPDX-License-Identifier: GPL-2.0-or-later

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {LauncherDialog} from './lib/launcherDialog.js';
import * as ClipboardHistory from './lib/clipboardHistory.js';

export default class GnomeLauncherExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._dialog = null;

        ClipboardHistory.startTracking();

        Main.wm.addKeybinding(
            'toggle-launcher',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => this._toggle()
        );
    }

    disable() {
        Main.wm.removeKeybinding('toggle-launcher');
        ClipboardHistory.stopTracking();
        this._dialog?.close();
        this._dialog = null;
        this._settings = null;
    }

    _toggle() {
        if (this._dialog) {
            this._dialog.close();
            this._dialog = null;
            return;
        }
        this._dialog = new LauncherDialog(this._settings);
        this._dialog.connect('closed', () => {
            this._dialog = null;
        });
        this._dialog.open();
    }
}
