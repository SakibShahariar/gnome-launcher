// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const LAYOUT_NAMES = [
    'list', 'grid', 'hotkey', 'sidebar', 'split-preview', 'dock',
    'fullscreen', 'top-dropdown', 'corner', 'full-edge', 'adaptive-width',
    'krunner', 'split-tabs', 'hero-banner', 'notch',
];

const MODIFIER_KEYVALS = new Set([
    Gdk.KEY_Shift_L, Gdk.KEY_Shift_R,
    Gdk.KEY_Control_L, Gdk.KEY_Control_R,
    Gdk.KEY_Alt_L, Gdk.KEY_Alt_R,
    Gdk.KEY_Super_L, Gdk.KEY_Super_R,
    Gdk.KEY_Meta_L, Gdk.KEY_Meta_R,
    Gdk.KEY_ISO_Level3_Shift,
]);

export default class GnomeLauncherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();

        // -- Layout ------------------------------------------------------

        const layoutGroup = new Adw.PreferencesGroup({title: 'Layout'});
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
        layoutGroup.add(layoutRow);
        page.add(layoutGroup);

        // -- Keybinding ----------------------------------------------------

        const keybindGroup = new Adw.PreferencesGroup({
            title: 'Keyboard shortcut',
            description: 'Default is Ctrl+Alt+Space, chosen to avoid colliding with '
                + "GNOME's own Super+Space input-source switcher.",
        });
        const keybindRow = new Adw.ActionRow({title: 'Toggle launcher'});

        const shortcutLabel = new Gtk.ShortcutLabel({valign: Gtk.Align.CENTER});
        const updateLabel = () => {
            const [accel] = settings.get_strv('toggle-launcher');
            shortcutLabel.set_accelerator(accel || '');
        };
        updateLabel();

        const editButton = new Gtk.Button({
            child: shortcutLabel,
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: 'Click to record a new shortcut',
        });
        editButton.connect('clicked', () => this._openRecorder(window, settings, updateLabel));

        keybindRow.add_suffix(editButton);
        keybindRow.activatable_widget = editButton;
        keybindGroup.add(keybindRow);
        page.add(keybindGroup);

        // -- Icon scale --------------------------------------------------

        const sizeGroup = new Adw.PreferencesGroup({
            title: 'Appearance',
            description: 'Applies to every layout. Font-size scaling isn\'t implemented yet.',
        });
        const scaleRow = new Adw.SpinRow({
            title: 'Icon size',
            subtitle: '1.0 is the default size',
            adjustment: new Gtk.Adjustment({
                lower: 0.7,
                upper: 1.6,
                step_increment: 0.1,
                page_increment: 0.2,
                value: settings.get_double('icon-scale'),
            }),
            digits: 1,
        });
        scaleRow.connect('notify::value', () => {
            settings.set_double('icon-scale', scaleRow.value);
        });
        sizeGroup.add(scaleRow);
        page.add(sizeGroup);

        window.add(page);
    }

    _openRecorder(parentWindow, settings, updateLabel) {
        const dialog = new Gtk.Window({
            title: 'Set shortcut',
            transient_for: parentWindow,
            modal: true,
            default_width: 340,
            default_height: 140,
            resizable: false,
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 28,
            margin_bottom: 28,
            margin_start: 24,
            margin_end: 24,
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
        });
        box.append(new Gtk.Label({
            label: 'Press a new key combination…',
            css_classes: ['title-4'],
        }));
        box.append(new Gtk.Label({
            label: 'Esc to cancel',
            css_classes: ['dim-label'],
        }));
        dialog.set_child(box);

        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (_ctrl, keyval, _keycode, state) => {
            if (keyval === Gdk.KEY_Escape) {
                dialog.close();
                return true;
            }
            const mods = state & Gtk.accelerator_get_default_mod_mask();
            if (mods === 0 && MODIFIER_KEYVALS.has(keyval))
                return true;

            if (Gtk.accelerator_valid(keyval, mods)) {
                const accel = Gtk.accelerator_name(keyval, mods);
                settings.set_strv('toggle-launcher', [accel]);
                updateLabel();
                dialog.close();
            }
            return true;
        });
        dialog.add_controller(controller);
        dialog.present();
    }
}
