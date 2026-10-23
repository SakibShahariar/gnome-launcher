// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {LAYOUT_NAMES} from './lib/layoutNames.js';
import {isValidTerminalTemplateArgs} from './lib/terminalTemplate.js';

const MODIFIER_KEYVALS = new Set([
    Gdk.KEY_Shift_L, Gdk.KEY_Shift_R,
    Gdk.KEY_Control_L, Gdk.KEY_Control_R,
    Gdk.KEY_Alt_L, Gdk.KEY_Alt_R,
    Gdk.KEY_Super_L, Gdk.KEY_Super_R,
    Gdk.KEY_Meta_L, Gdk.KEY_Meta_R,
    Gdk.KEY_ISO_Level3_Shift,
]);

const DEFAULT_SHORTCUT = '<Control><Alt>space';

function expandHomePath(path) {
    const trimmed = path.trim();
    if (trimmed === '~')
        return GLib.get_home_dir();
    if (trimmed.startsWith('~/'))
        return GLib.build_filenamev([GLib.get_home_dir(), trimmed.slice(2)]);
    return trimmed;
}

function savePathSetting(row, settings, key) {
    const value = row.get_text().trim();
    if (!value) {
        settings.set_string(key, '');
        row.remove_css_class('error');
        row.set_tooltip_text(null);
        return;
    }

    try {
        const file = Gio.File.new_for_path(expandHomePath(value));
        const info = file.query_info('standard::type', Gio.FileQueryInfoFlags.NONE, null);
        if (info.get_file_type() !== Gio.FileType.REGULAR)
            throw new Error('Path is not a regular file');
        settings.set_string(key, value);
        row.remove_css_class('error');
        row.set_tooltip_text(null);
    } catch {
        row.add_css_class('error');
        row.set_tooltip_text('File does not exist or is not accessible; the saved path was not changed.');
    }
}

function commitPathOnFocusLeave(row, callback) {
    const controller = new Gtk.EventControllerFocus();
    controller.connect('leave', callback);
    row.add_controller(controller);
}

export default class GnomeLauncherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // -- General page: layout + keybinding -----------------------------

        const generalPage = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });

        const page = generalPage;

        // -- Layout ------------------------------------------------------

        const layoutGroup = new Adw.PreferencesGroup({title: 'Layout'});
        const layoutRow = new Adw.ComboRow({
            title: 'Launcher layout',
            subtitle: `${LAYOUT_NAMES.length} layouts available. Changes apply the next time you open the launcher.`,
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

        const resetButton = new Gtk.Button({
            label: 'Reset',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: 'Restore the default shortcut',
        });
        resetButton.connect('clicked', () => {
            settings.set_strv('toggle-launcher', [DEFAULT_SHORTCUT]);
            updateLabel();
        });
        const clearButton = new Gtk.Button({
            label: 'Clear',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: 'Disable the launcher shortcut',
        });
        clearButton.connect('clicked', () => {
            settings.set_strv('toggle-launcher', []);
            updateLabel();
        });

        keybindRow.add_suffix(editButton);
        keybindRow.add_suffix(resetButton);
        keybindRow.add_suffix(clearButton);
        keybindRow.activatable_widget = editButton;
        keybindGroup.add(keybindRow);
        page.add(keybindGroup);

        // -- Clipboard history privacy -----------------------------------

        const privacyGroup = new Adw.PreferencesGroup({title: 'Privacy'});
        const clipboardRow = new Adw.ActionRow({
            title: 'Clipboard history',
            subtitle: 'Opt in to collecting up to 20 recent text entries in memory',
        });
        const clipboardSwitch = new Gtk.Switch({
            active: settings.get_boolean('clipboard-history-enabled'),
            valign: Gtk.Align.CENTER,
        });
        clipboardSwitch.connect('notify::active', () => {
            settings.set_boolean('clipboard-history-enabled', clipboardSwitch.active);
        });
        clipboardRow.add_suffix(clipboardSwitch);
        clipboardRow.activatable_widget = clipboardSwitch;
        privacyGroup.add(clipboardRow);

        const clearHistoryRow = new Adw.ActionRow({
            title: 'Clear clipboard history',
            subtitle: 'Remove all retained entries from memory',
        });
        const clearHistoryButton = new Gtk.Button({
            label: 'Clear',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        clearHistoryButton.connect('clicked', () => {
            const key = 'clipboard-history-clear-request';
            const current = settings.get_int(key);
            settings.set_int(key, current >= 2147483647 ? 0 : current + 1);
        });
        clearHistoryRow.add_suffix(clearHistoryButton);
        privacyGroup.add(clearHistoryRow);
        page.add(privacyGroup);

        const windowGroup = new Adw.PreferencesGroup({title: 'Window search'});
        const allWorkspacesRow = new Adw.ActionRow({
            title: 'Search all workspaces',
            subtitle: 'Include windows from workspaces other than the current one',
        });
        const allWorkspacesSwitch = new Gtk.Switch({
            active: settings.get_boolean('windows-all-workspaces'),
            valign: Gtk.Align.CENTER,
        });
        allWorkspacesSwitch.connect('notify::active', () => {
            settings.set_boolean('windows-all-workspaces', allWorkspacesSwitch.active);
        });
        allWorkspacesRow.add_suffix(allWorkspacesSwitch);
        allWorkspacesRow.activatable_widget = allWorkspacesSwitch;
        windowGroup.add(allWorkspacesRow);
        page.add(windowGroup);

        const webSearchGroup = new Adw.PreferencesGroup({title: 'Web search'});
        const searchTemplateRow = new Adw.EntryRow({
            title: 'Search URL template',
            text: settings.get_string('search-url-template'),
        });
        searchTemplateRow.set_show_apply_button(true);
        searchTemplateRow.connect('apply', () => {
            const value = searchTemplateRow.text.trim();
            if (/^https?:\/\//i.test(value) && value.includes('{query}') && !/[\r\n]/.test(value)) {
                settings.set_string('search-url-template', value);
                searchTemplateRow.remove_css_class('error');
                searchTemplateRow.set_tooltip_text(null);
            } else {
                searchTemplateRow.add_css_class('error');
                searchTemplateRow.set_tooltip_text('Use an HTTP(S) URL containing {query}.');
            }
        });
        webSearchGroup.add(searchTemplateRow);
        page.add(webSearchGroup);

        const terminalGroup = new Adw.PreferencesGroup({
            title: 'Run in terminal',
            description: 'Optional command template. Use {command} as a standalone argument; leave empty for automatic terminal detection.',
        });
        const terminalTemplateRow = new Adw.EntryRow({
            title: 'Terminal command template',
            text: settings.get_string('terminal-command-template'),
        });
        terminalTemplateRow.set_show_apply_button(true);
        terminalTemplateRow.connect('apply', () => {
            const value = terminalTemplateRow.text.trim();
            if (!value) {
                settings.set_string('terminal-command-template', '');
                terminalTemplateRow.remove_css_class('error');
                terminalTemplateRow.set_tooltip_text(null);
                return;
            }

            try {
                const [success, argv] = GLib.shell_parse_argv(value);
                if (!success || !isValidTerminalTemplateArgs(argv))
                    throw new Error('invalid template');
                settings.set_string('terminal-command-template', value);
                terminalTemplateRow.remove_css_class('error');
                terminalTemplateRow.set_tooltip_text(null);
            } catch {
                terminalTemplateRow.add_css_class('error');
                terminalTemplateRow.set_tooltip_text('Use a valid command with exactly one standalone {command} placeholder, e.g. ptyxis -- {command}.');
            }
        });
        terminalGroup.add(terminalTemplateRow);
        page.add(terminalGroup);

        window.add(generalPage);

        // -- Appearance page: icon scale + transparency + theming ---------

        const appearancePage = new Adw.PreferencesPage({
            title: 'Appearance',
            icon_name: 'preferences-desktop-appearance-symbolic',
        });

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

        const plateRow = new Adw.ActionRow({
            title: 'App icon plates',
            subtitle: 'Rounded surface plate behind each app icon',
        });
        const plateSwitch = new Gtk.Switch({
            active: settings.get_boolean('app-icon-plates'),
            valign: Gtk.Align.CENTER,
        });
        plateSwitch.connect('notify::active', () => {
            settings.set_boolean('app-icon-plates', plateSwitch.active);
        });
        plateRow.add_suffix(plateSwitch);
        plateRow.activatable_widget = plateSwitch;
        sizeGroup.add(plateRow);
        appearancePage.add(sizeGroup);

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
        const opacitySettingsSignalId = settings.connect('changed::background-opacity', () => {
            const v = settings.get_double('background-opacity');
            if (Math.abs(opacityScale.get_value() - v) > 0.001)
                opacityScale.set_value(v);
        });
        window.connect('close-request', () => {
            settings.disconnect(opacitySettingsSignalId);
            return false;
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

        appearancePage.add(opacityGroup);

        // -- Theme / wallpaper paths ------------------------------------

        const themeGroup = new Adw.PreferencesGroup({
            title: 'Theming',
            description: 'Optional paths for Matugen colors and wallpaper. Leave empty for built-in defaults.',
        });

        const themePathRow = new Adw.EntryRow({
            title: 'Theme CSS file',
            text: settings.get_string('theme-file-path') || '',
        });
        const saveThemePath = () => savePathSetting(themePathRow, settings, 'theme-file-path');
        commitPathOnFocusLeave(themePathRow, saveThemePath);
        themeGroup.add(themePathRow);

        const wallpaperPathRow = new Adw.EntryRow({
            title: 'Wallpaper image',
            text: settings.get_string('wallpaper-path') || '',
        });
        const saveWallpaperPath = () => savePathSetting(wallpaperPathRow, settings, 'wallpaper-path');
        commitPathOnFocusLeave(wallpaperPathRow, saveWallpaperPath);
        themeGroup.add(wallpaperPathRow);

        window.connect('close-request', () => {
            saveThemePath();
            saveWallpaperPath();
            return false;
        });

        appearancePage.add(themeGroup);

        window.add(appearancePage);
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
