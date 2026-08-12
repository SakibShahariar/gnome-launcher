// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const LAYOUT_NAMES = [
    'list', 'grid', 'hotkey', 'sidebar', 'split-preview', 'dock',
    'fullscreen', 'top-dropdown', 'corner', 'full-edge', 'adaptive-width',
    'krunner', 'split-tabs', 'hero-banner',
];

export default class GnomeLauncherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({title: 'Layout'});

        const layoutRow = new Adw.ComboRow({
            title: 'Launcher layout',
            subtitle: 'More layouts are added the same way - see the README',
            model: Gtk.StringList.new(LAYOUT_NAMES),
        });
        const current = settings.get_string('layout');
        const currentIndex = LAYOUT_NAMES.indexOf(current);
        layoutRow.selected = currentIndex === -1 ? 0 : currentIndex;
        layoutRow.connect('notify::selected', () => {
            settings.set_string('layout', LAYOUT_NAMES[layoutRow.selected]);
        });
        group.add(layoutRow);

        page.add(group);
        window.add(page);
    }
}
