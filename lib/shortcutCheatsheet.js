// SPDX-License-Identifier: GPL-2.0-or-later

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {ModalDialog} from 'resource:///org/gnome/shell/ui/modalDialog.js';

const SHORTCUTS = [
    ['Ctrl + Alt + Space', 'Open or close GNOME Launcher'],
    ['↑ / ↓', 'Move through results'],
    ['Enter', 'Launch the selected app or activate the selected result'],
    ['Escape', 'Close the launcher or this cheatsheet'],
    ['Ctrl + Enter', 'Run the current command in a terminal (Run mode)'],
    ['Ctrl + 1 … 9', 'Switch modes in layouts that expose mode shortcuts'],
    ['> command', 'Run a command'],
    ['/ name', 'Find files'],
    ['w name', 'Find open windows'],
    ['; text', 'Search clipboard history (when enabled)'],
    ['= expression', 'Calculate an expression'],
    ['? query', 'Search the web'],
    ['recent query', 'Find recent documents'],
    ['emoji query', 'Find emoji'],
    ['s name / settings name', 'Find GNOME Settings panels'],
];

export const ShortcutCheatsheet = GObject.registerClass(
class ShortcutCheatsheet extends ModalDialog {
    _init() {
        super._init({styleClass: 'launcher-shortcuts-cheatsheet', destroyOnClose: true});
        this.dialogLayout.set_style(
            'background-color: transparent; border: none; box-shadow: none; padding: 0;'
        );
        this.contentLayout.set_style('background-color: transparent; padding: 0; margin: 0;');
        this.buttonLayout.hide();

        const card = new St.BoxLayout({
            vertical: true,
            style: 'min-width: 520px; max-width: 680px; padding: 24px; spacing: 12px; border-radius: 20px; background-color: #202124; color: #f5f5f5;',
        });
        const title = new St.Label({
            text: 'Keyboard shortcuts',
            style: 'font-size: 22px; font-weight: bold; padding-bottom: 4px;',
            x_align: Clutter.ActorAlign.START,
        });
        card.add_child(title);

        const subtitle = new St.Label({
            text: 'GNOME Launcher · Press Escape to close',
            style: 'font-size: 12px; color: #c4c7c5; padding-bottom: 8px;',
            x_align: Clutter.ActorAlign.START,
        });
        card.add_child(subtitle);

        for (const [shortcut, description] of SHORTCUTS) {
            const row = new St.BoxLayout({
                vertical: false,
                x_expand: true,
                style: 'spacing: 18px; padding: 3px 0;',
            });
            const keycap = new St.Label({
                text: shortcut,
                style: 'font-family: monospace; font-weight: bold; padding: 5px 8px; border-radius: 6px; background-color: #3c4043; color: #ffffff; min-width: 140px;',
                x_align: Clutter.ActorAlign.CENTER,
            });
            const label = new St.Label({
                text: description,
                style: 'font-size: 13px; color: #f1f3f4;',
                x_align: Clutter.ActorAlign.START,
                x_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
                y_expand: true,
            });
            row.add_child(keycap);
            row.add_child(label);
            card.add_child(row);
        }

        this.contentLayout.add_child(card);
    }
}
);
