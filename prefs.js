// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {LAYOUT_NAMES} from './lib/layoutNames.js';

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
            subtitle: `${LAYOUT_NAMES.length} layouts available`,
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

        const keybindGroup = new Adw.PreferencesGroup({title: 'Keyboard shortcut'});
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

        const sizeGroup = new Adw.PreferencesGroup({title: 'Appearance'});
        const scaleRow = new Adw.SpinRow({
            title: 'Icon size',
            subtitle: '1.0 = default',
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

        // -- Background opacity (global transparency for Blur My Shell) --

        const opacityGroup = new Adw.PreferencesGroup({title: 'Transparency'});

        const opacityRow = new Adw.ActionRow({
            title: 'Background opacity',
            subtitle: 'Lower = more blur',
        });
        const opacityScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 0.0,
                upper: 1.0,
                step_increment: 0.05,
                page_increment: 0.1,
                value: settings.get_double('background-opacity'),
            }),
            digits: 2,
            hexpand: true,
            draw_value: true,
            value_pos: Gtk.PositionType.RIGHT,
            width_request: 220,
        });
        opacityScale.set_size_request(220, -1);
        opacityScale.connect('value-changed', () => {
            settings.set_double('background-opacity', opacityScale.get_value());
        });
        settings.connect('changed::background-opacity', () => {
            const v = settings.get_double('background-opacity');
            if (Math.abs(opacityScale.get_value() - v) > 0.001)
                opacityScale.set_value(v);
        });
        opacityRow.add_suffix(opacityScale);
        opacityGroup.add(opacityRow);

        const dimRow = new Adw.ActionRow({
            title: 'Dim background',
            subtitle: 'Darken the screen behind the launcher',
        });
        const dimSwitch = new Gtk.Switch({
            active: settings.get_boolean('dim-background'),
            valign: Gtk.Align.CENTER,
        });
        dimSwitch.connect('notify::active', () => {
            settings.set_boolean('dim-background', dimSwitch.active);
        });
        dimRow.add_suffix(dimSwitch);
        dimRow.activatable_widget = dimSwitch;
        opacityGroup.add(dimRow);

        page.add(opacityGroup);

        // -- Theme / wallpaper paths ------------------------------------

        const themeGroup = new Adw.PreferencesGroup({
            title: 'Theming',
            description: 'Optional paths for Matugen colors and wallpaper. Leave empty for built-in defaults.',
        });

        const themePathRow = new Adw.EntryRow({
            title: 'Theme CSS file',
            text: settings.get_string('theme-file-path') || '',
        });
        themePathRow.connect('changed', () => {
            settings.set_string('theme-file-path', themePathRow.get_text().trim());
        });
        themeGroup.add(themePathRow);

        const wallpaperPathRow = new Adw.EntryRow({
            title: 'Wallpaper image',
            text: settings.get_string('wallpaper-path') || '',
        });
        wallpaperPathRow.connect('changed', () => {
            settings.set_string('wallpaper-path', wallpaperPathRow.get_text().trim());
        });
        themeGroup.add(wallpaperPathRow);

        page.add(themeGroup);

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
