// SPDX-License-Identifier: GPL-2.0-or-later

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {LAYOUT_NAMES} from './lib/layoutNames.js';
import {FINDERS} from './lib/finderPrefix.js';
import {LAYOUT_GALLERY} from './lib/layoutGallery.js';
import {setLayoutAppearanceOverride} from './lib/layoutAppearance.js';
import {isValidTerminalTemplateArgs} from './lib/terminalTemplate.js';
import {MODE_OPTIONS, normalizeVisibleModes} from './lib/modeVisibility.js';
import {normalizeQuicklinks, serializeQuicklinks, MAX_QUICKLINKS} from './lib/quicklinks.js';
import {normalizeSnippets, serializeSnippets, MAX_SNIPPETS} from './lib/snippets.js';

const MODIFIER_KEYVALS = new Set([
    Gdk.KEY_Shift_L, Gdk.KEY_Shift_R,
    Gdk.KEY_Control_L, Gdk.KEY_Control_R,
    Gdk.KEY_Alt_L, Gdk.KEY_Alt_R,
    Gdk.KEY_Super_L, Gdk.KEY_Super_R,
    Gdk.KEY_Meta_L, Gdk.KEY_Meta_R,
    Gdk.KEY_ISO_Level3_Shift,
]);

const DEFAULT_SHORTCUT = '<Control><Alt>space';

const LAYOUT_SELECTOR_CSS = `
.launcher-layout-selector button {
    min-width: 16rem;
}
`;

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
        settings.set_string(key, expandHomePath(value));
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

function iconButton(iconName, tooltip, onClick) {
    const button = new Gtk.Button({
        icon_name: iconName,
        valign: Gtk.Align.CENTER,
        css_classes: ['flat'],
        tooltip_text: tooltip,
    });
    button.connect('clicked', onClick);
    return button;
}

export default class GnomeLauncherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const selectorCss = new Gtk.CssProvider();
        selectorCss.load_from_string(LAYOUT_SELECTOR_CSS);
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(), selectorCss,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        // -- General page: behavior, shortcut, and finders -----------------

        const generalPage = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });

        const page = generalPage;
        const visibleModes = normalizeVisibleModes(settings.get_strv('visible-modes'));

        // Keep visual layout selection separate from routine launcher
        // settings. The gallery contains fifteen previews and otherwise makes
        // the General page unnecessarily long.
        const layoutsPage = new Adw.PreferencesPage({
            title: 'Layouts',
            icon_name: 'view-grid-symbolic',
        });

        // -- Layout ------------------------------------------------------

        const layoutGroup = new Adw.PreferencesGroup({title: 'Layout'});
        const layoutRow = new Adw.ComboRow({
            title: 'Launcher layout',
            subtitle: `${LAYOUT_NAMES.length} layouts available. Changes apply the next time you open the launcher.`,
            model: Gtk.StringList.new(LAYOUT_NAMES),
        });
        // ComboRow's selected value is an internal button. Style that button
        // directly so its collapsed state has a comfortably sized target.
        layoutRow.add_css_class('launcher-layout-selector');
        const current = settings.get_string('layout');
        const currentIndex = LAYOUT_NAMES.indexOf(current);
        layoutRow.selected = currentIndex === -1 ? 0 : currentIndex;
        layoutGroup.add(layoutRow);

        const defaultModeFinders = FINDERS.list().filter(finder =>
            finder.defaultMode !== false &&
            (visibleModes.includes(finder.mode) || finder.mode === 'apps'));
        const defaultModeIds = defaultModeFinders.map(finder => finder.mode);
        const defaultModeGroup = new Adw.PreferencesGroup({title: 'Default finder'});
        const defaultModeRow = new Adw.ComboRow({
            title: 'Finder when opening the launcher',
            subtitle: 'Used by Sidebar, Split Tabs, and Hero Banner layouts; other layouts open Applications.',
            model: Gtk.StringList.new(defaultModeFinders.map(finder => finder.label)),
        });
        const selectedDefaultMode = defaultModeIds.indexOf(settings.get_string('default-mode'));
        defaultModeRow.selected = selectedDefaultMode < 0 ? 0 : selectedDefaultMode;
        defaultModeRow.connect('notify::selected', () => {
            const mode = defaultModeIds[defaultModeRow.selected];
            if (mode)
                settings.set_string('default-mode', mode);
        });
        defaultModeGroup.add(defaultModeRow);
        page.add(defaultModeGroup);

        // -- Initial panel ------------------------------------------------

        const startupGroup = new Adw.PreferencesGroup({title: 'Startup'});
        const initialPanelRow = new Adw.ActionRow({
            title: 'Show initial panel',
            subtitle: 'Greeting, favorites, and hints; off shows favorites and recent apps',
        });
        const initialPanelSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-initial-panel'),
            valign: Gtk.Align.CENTER,
        });
        initialPanelSwitch.connect('notify::active', () => {
            settings.set_boolean('show-initial-panel', initialPanelSwitch.active);
        });
        initialPanelRow.add_suffix(initialPanelSwitch);
        initialPanelRow.activatable_widget = initialPanelSwitch;
        startupGroup.add(initialPanelRow);
        page.add(startupGroup);

        // -- Visible modes -------------------------------------------------

        const modesGroup = new Adw.PreferencesGroup({
            title: 'Visible modes',
            description: 'Choose which modes appear in Sidebar, Split Tabs, and Hero Banner. Changes apply the next time you open the launcher.',
        });
        const modeChecks = new Map();
        for (const {id, label} of MODE_OPTIONS) {
            const row = new Adw.ActionRow({
                title: label,
                subtitle: id === 'apps' ? 'Always available as the fallback' : null,
            });
            const check = new Gtk.CheckButton({
                active: visibleModes.includes(id),
                valign: Gtk.Align.CENTER,
            });
            if (id === 'apps')
                check.set_sensitive(false);
            check.connect('toggled', () => {
                let ids = normalizeVisibleModes(settings.get_strv('visible-modes'));
                if (check.active) {
                    if (!ids.includes(id))
                        ids.push(id);
                } else {
                    ids = ids.filter(value => value !== id);
                }
                settings.set_strv('visible-modes', normalizeVisibleModes(ids));
            });
            row.add_suffix(check);
            if (id !== 'apps')
                row.activatable_widget = check;
            modesGroup.add(row);
            modeChecks.set(id, check);
        }
        const refreshDefaultModes = () => {
            const ids = normalizeVisibleModes(settings.get_strv('visible-modes'));
            const finders = FINDERS.list().filter(finder =>
                finder.defaultMode !== false &&
                (ids.includes(finder.mode) || finder.mode === 'apps'));
            defaultModeIds.splice(0, defaultModeIds.length, ...finders.map(f => f.mode));
            defaultModeRow.model = Gtk.StringList.new(finders.map(f => f.label));
            let index = defaultModeIds.indexOf(settings.get_string('default-mode'));
            if (index < 0) {
                settings.set_string('default-mode', 'apps');
                index = defaultModeIds.indexOf('apps');
            }
            defaultModeRow.selected = index;
        };
        const modesSettingsSignalId = settings.connect('changed::visible-modes', () => {
            const ids = normalizeVisibleModes(settings.get_strv('visible-modes'));
            for (const [id, check] of modeChecks) {
                if (check.active !== ids.includes(id))
                    check.active = ids.includes(id);
            }
            refreshDefaultModes();
        });
        window.connect('close-request', () => {
            settings.disconnect(modesSettingsSignalId);
            return false;
        });
        page.add(modesGroup);

        layoutsPage.add(layoutGroup);

        // -- Layout gallery ------------------------------------------------
        // Keep the dropdown for quick selection while also offering visual previews.
        const galleryGroup = new Adw.PreferencesGroup({
            title: 'Layout gallery',
            description: `Preview all ${LAYOUT_NAMES.length} layouts. Selecting one applies it the next time you open the launcher.`,
        });
        const galleryButtons = new Map();
        const updateGallerySelection = () => {
            const selectedLayout = settings.get_string('layout');
            for (const [layout, button] of galleryButtons) {
                const selected = layout === selectedLayout;
                button.label = selected ? 'Selected' : 'Select';
                button.sensitive = !selected;
            }
        };

        for (const item of LAYOUT_GALLERY) {
            const row = new Adw.ActionRow({
                title: item.title,
                subtitle: item.description,
            });
            const screenshotPath = GLib.build_filenamev([
                this.path, 'screenshots', item.screenshot,
            ]);
            let preview;
            try {
                // Decode a thumbnail rather than retaining each full-resolution
                // screenshot texture in Preferences.
                const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                    screenshotPath, 144, 81, true
                );
                preview = Gtk.Picture.new_for_paintable(Gdk.Texture.new_for_pixbuf(pixbuf));
                preview.set_size_request(144, 81);
                preview.set_can_shrink(true);
                preview.set_valign(Gtk.Align.CENTER);
            } catch {
                preview = new Gtk.Image({
                    icon_name: 'image-missing-symbolic',
                    pixel_size: 48,
                    valign: Gtk.Align.CENTER,
                    tooltip_text: 'Preview image is unavailable',
                });
                preview.set_size_request(144, 81);
            }
            row.add_prefix(preview);

            const selectButton = new Gtk.Button({
                label: 'Select',
                valign: Gtk.Align.CENTER,
                tooltip_text: `Use the ${item.title} layout the next time the launcher opens`,
            });
            selectButton.connect('clicked', () => {
                settings.set_string('layout', item.id);
                layoutRow.selected = LAYOUT_NAMES.indexOf(item.id);
                updateGallerySelection();
            });
            row.add_suffix(selectButton);
            row.activatable_widget = selectButton;
            galleryButtons.set(item.id, selectButton);
            galleryGroup.add(row);
        }
        layoutRow.connect('notify::selected', () => {
            settings.set_string('layout', LAYOUT_NAMES[layoutRow.selected]);
            updateGallerySelection();
        });
        updateGallerySelection();
        layoutsPage.add(galleryGroup);

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
            subtitle: 'Opt in to 20 recent text and image entries; original image data is capped at 8 MiB total',
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

        // -- Quick links ---------------------------------------------------

        const quicklinksGroup = new Adw.PreferencesGroup({
            title: 'Quick links',
            description: `Shortcuts opened by typing their trigger before a query. Use one {query} placeholder and an http(s) URL. Up to ${MAX_QUICKLINKS} links.`,
        });
        const loadQuicklinks = () => normalizeQuicklinks(settings.get_string('quicklinks'));
        const saveQuicklinks = links =>
            settings.set_string('quicklinks', serializeQuicklinks(links));

        const triggerRow = new Adw.EntryRow({title: 'Trigger'});
        const nameRow = new Adw.EntryRow({title: 'Name'});
        const urlRow = new Adw.EntryRow({title: 'URL template'});
        const addQuicklinkRow = new Adw.ActionRow({title: 'Add a quick link'});
        const addQuicklinkButton = new Gtk.Button({
            label: 'Add',
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });
        addQuicklinkRow.add_suffix(addQuicklinkButton);
        addQuicklinkRow.activatable_widget = addQuicklinkButton;

        const cancelQuicklinkButton = new Gtk.Button({
            label: 'Cancel',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            visible: false,
        });
        addQuicklinkRow.add_suffix(cancelQuicklinkButton);

        let editingQuicklink = null;
        const resetQuicklinkForm = () => {
            editingQuicklink = null;
            triggerRow.set_text('');
            nameRow.set_text('');
            urlRow.set_text('');
            addQuicklinkButton.set_label('Add');
            cancelQuicklinkButton.set_visible(false);
            urlRow.remove_css_class('error');
            urlRow.set_tooltip_text(null);
        };
        cancelQuicklinkButton.connect('clicked', resetQuicklinkForm);

        const markQuicklinkError = message => {
            urlRow.add_css_class('error');
            urlRow.set_tooltip_text(message);
        };
        addQuicklinkButton.connect('clicked', () => {
            urlRow.remove_css_class('error');
            urlRow.set_tooltip_text(null);
            const candidate = {
                trigger: triggerRow.get_text(),
                name: nameRow.get_text(),
                url: urlRow.get_text(),
            };
            const current = loadQuicklinks();
            const base = editingQuicklink === null
                ? current : current.filter(item => item.trigger !== editingQuicklink);
            const expected = base.length + 1;
            if (expected > MAX_QUICKLINKS) {
                markQuicklinkError(`Maximum of ${MAX_QUICKLINKS} quick links reached.`);
                return;
            }
            const updated = normalizeQuicklinks([...base, candidate]);
            if (updated.length !== expected) {
                markQuicklinkError('Use a unique lowercase trigger and a single {query} placeholder in an http(s) URL.');
                return;
            }
            saveQuicklinks(updated);
            resetQuicklinkForm();
        });

        quicklinksGroup.add(triggerRow);
        quicklinksGroup.add(nameRow);
        quicklinksGroup.add(urlRow);
        quicklinksGroup.add(addQuicklinkRow);

        let quicklinkRows = [];
        const refreshQuicklinks = () => {
            for (const row of quicklinkRows)
                quicklinksGroup.remove(row);
            quicklinkRows = [];
            const links = loadQuicklinks();
            links.forEach((link, index) => {
                const row = new Adw.ActionRow({
                    title: `${link.trigger} — ${link.name}`,
                    subtitle: link.url,
                });
                const enabledSwitch = new Gtk.Switch({
                    active: link.enabled,
                    valign: Gtk.Align.CENTER,
                });
                enabledSwitch.connect('notify::active', () => {
                    saveQuicklinks(loadQuicklinks().map(item =>
                        item.trigger === link.trigger ? {...item, enabled: enabledSwitch.active} : item));
                });
                row.add_suffix(enabledSwitch);

                const move = offset => {
                    const target = index + offset;
                    if (target < 0 || target >= links.length)
                        return;
                    const reordered = [...links];
                    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
                    saveQuicklinks(reordered);
                };
                if (index > 0)
                    row.add_suffix(iconButton('go-up-symbolic', 'Move up', () => move(-1)));
                if (index < links.length - 1)
                    row.add_suffix(iconButton('go-down-symbolic', 'Move down', () => move(1)));

                row.add_suffix(iconButton('document-edit-symbolic', 'Edit quick link', () => {
                    triggerRow.set_text(link.trigger);
                    nameRow.set_text(link.name);
                    urlRow.set_text(link.url);
                    editingQuicklink = link.trigger;
                    addQuicklinkButton.set_label('Save');
                    cancelQuicklinkButton.set_visible(true);
                }));
                row.add_suffix(iconButton('user-trash-symbolic', 'Remove quick link', () =>
                    saveQuicklinks(loadQuicklinks().filter(item => item.trigger !== link.trigger))));
                quicklinksGroup.add(row);
                quicklinkRows.push(row);
            });
        };
        refreshQuicklinks();
        const quicklinksSignalId = settings.connect('changed::quicklinks', refreshQuicklinks);
        window.connect('close-request', () => {
            settings.disconnect(quicklinksSignalId);
            return false;
        });
        page.add(quicklinksGroup);

        // -- Text snippets -------------------------------------------------

        const snippetsGroup = new Adw.PreferencesGroup({
            title: 'Text snippets',
            description: `Reusable text opened with the # finder. Up to ${MAX_SNIPPETS} snippets; activating one copies it so you can paste it into the previous app.`,
        });
        const loadSnippets = () => normalizeSnippets(settings.get_string('snippets'));
        const saveSnippets = items => settings.set_string('snippets', serializeSnippets(items));

        const snippetTitleRow = new Adw.EntryRow({title: 'Title'});
        const snippetTriggerRow = new Adw.EntryRow({title: 'Trigger (optional)'});
        const snippetContentRow = new Adw.EntryRow({title: 'Text'});
        const addSnippetRow = new Adw.ActionRow({title: 'Add a snippet'});
        const addSnippetButton = new Gtk.Button({
            label: 'Add',
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });
        addSnippetRow.add_suffix(addSnippetButton);
        addSnippetRow.activatable_widget = addSnippetButton;

        const cancelSnippetButton = new Gtk.Button({
            label: 'Cancel',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            visible: false,
        });
        addSnippetRow.add_suffix(cancelSnippetButton);

        let editingSnippet = null;
        const resetSnippetForm = () => {
            editingSnippet = null;
            snippetTitleRow.set_text('');
            snippetTriggerRow.set_text('');
            snippetContentRow.set_text('');
            addSnippetButton.set_label('Add');
            cancelSnippetButton.set_visible(false);
            snippetContentRow.remove_css_class('error');
            snippetContentRow.set_tooltip_text(null);
        };
        cancelSnippetButton.connect('clicked', resetSnippetForm);

        addSnippetButton.connect('clicked', () => {
            snippetContentRow.remove_css_class('error');
            snippetContentRow.set_tooltip_text(null);
            const current = loadSnippets();
            const base = editingSnippet === null
                ? current : current.filter(item => item.id !== editingSnippet);
            const expected = base.length + 1;
            if (expected > MAX_SNIPPETS) {
                snippetContentRow.add_css_class('error');
                snippetContentRow.set_tooltip_text(`Maximum of ${MAX_SNIPPETS} snippets reached.`);
                return;
            }
            const candidate = {
                title: snippetTitleRow.get_text(),
                trigger: snippetTriggerRow.get_text(),
                content: snippetContentRow.get_text(),
            };
            const updated = normalizeSnippets([...base, candidate]);
            if (updated.length !== expected) {
                snippetContentRow.add_css_class('error');
                snippetContentRow.set_tooltip_text('Add a title and text; triggers must be unique lowercase words.');
                return;
            }
            saveSnippets(updated);
            resetSnippetForm();
        });

        snippetsGroup.add(snippetTitleRow);
        snippetsGroup.add(snippetTriggerRow);
        snippetsGroup.add(snippetContentRow);
        snippetsGroup.add(addSnippetRow);

        let snippetRows = [];
        const refreshSnippets = () => {
            for (const row of snippetRows)
                snippetsGroup.remove(row);
            snippetRows = [];
            const items = loadSnippets();
            items.forEach((snippet, index) => {
                const row = new Adw.ActionRow({
                    title: snippet.title,
                    subtitle: snippet.trigger ? `#${snippet.trigger}` : 'No trigger',
                });
                const enabledSwitch = new Gtk.Switch({
                    active: snippet.enabled,
                    valign: Gtk.Align.CENTER,
                });
                enabledSwitch.connect('notify::active', () => {
                    saveSnippets(loadSnippets().map(item =>
                        item.id === snippet.id ? {...item, enabled: enabledSwitch.active} : item));
                });
                row.add_suffix(enabledSwitch);

                const move = offset => {
                    const target = index + offset;
                    if (target < 0 || target >= items.length)
                        return;
                    const reordered = [...items];
                    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
                    saveSnippets(reordered);
                };
                if (index > 0)
                    row.add_suffix(iconButton('go-up-symbolic', 'Move up', () => move(-1)));
                if (index < items.length - 1)
                    row.add_suffix(iconButton('go-down-symbolic', 'Move down', () => move(1)));

                row.add_suffix(iconButton('document-edit-symbolic', 'Edit snippet', () => {
                    snippetTitleRow.set_text(snippet.title);
                    snippetTriggerRow.set_text(snippet.trigger);
                    snippetContentRow.set_text(snippet.content);
                    editingSnippet = snippet.id;
                    addSnippetButton.set_label('Save');
                    cancelSnippetButton.set_visible(true);
                }));
                row.add_suffix(iconButton('user-trash-symbolic', 'Remove snippet', () =>
                    saveSnippets(loadSnippets().filter(item => item.id !== snippet.id))));
                snippetsGroup.add(row);
                snippetRows.push(row);
            });
        };
        refreshSnippets();
        const snippetsSignalId = settings.connect('changed::snippets', refreshSnippets);
        window.connect('close-request', () => {
            settings.disconnect(snippetsSignalId);
            return false;
        });
        page.add(snippetsGroup);

        window.add(generalPage);
        window.add(layoutsPage);

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
            refreshLayoutAppearance();
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

        const focusLineRow = new Adw.ActionRow({
            title: 'Search focus line',
            subtitle: 'Accent underline under the search field when focused',
        });
        const focusLineSwitch = new Gtk.Switch({
            active: settings.get_boolean('show-search-focus-line'),
            valign: Gtk.Align.CENTER,
        });
        focusLineSwitch.connect('notify::active', () => {
            settings.set_boolean('show-search-focus-line', focusLineSwitch.active);
        });
        focusLineRow.add_suffix(focusLineSwitch);
        focusLineRow.activatable_widget = focusLineSwitch;
        sizeGroup.add(focusLineRow);
        appearancePage.add(sizeGroup);

        // -- Per-layout appearance overrides -----------------------------

        const layoutAppearanceGroup = new Adw.PreferencesGroup({
            title: 'Layout-specific appearance',
            description: 'Optional icon size and background opacity for one layout. Unset values use the global Appearance settings.',
        });
        const layoutAppearanceRow = new Adw.ComboRow({
            title: 'Layout',
            model: Gtk.StringList.new(LAYOUT_NAMES),
        });
        const initialLayout = settings.get_string('layout') || 'list';
        const initialLayoutIndex = LAYOUT_NAMES.indexOf(initialLayout);
        layoutAppearanceRow.selected = initialLayoutIndex < 0 ? 0 : initialLayoutIndex;
        layoutAppearanceGroup.add(layoutAppearanceRow);

        let updatingLayoutAppearance = false;
        const layoutScaleRow = new Adw.SpinRow({
            title: 'Icon size override',
            subtitle: 'Reset to inherit the global icon size',
            adjustment: new Gtk.Adjustment({
                lower: 0.7,
                upper: 1.6,
                step_increment: 0.1,
                page_increment: 0.2,
                value: settings.get_double('icon-scale'),
            }),
            digits: 1,
        });
        layoutAppearanceGroup.add(layoutScaleRow);

        const layoutOpacityRow = new Adw.ActionRow({
            title: 'Background opacity override',
            subtitle: 'Reset to inherit the global opacity',
        });
        const layoutOpacityScale = new Gtk.Scale({
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
        layoutOpacityScale.set_size_request(220, -1);
        layoutOpacityRow.add_suffix(layoutOpacityScale);
        layoutAppearanceGroup.add(layoutOpacityRow);

        const refreshLayoutAppearance = () => {
            const layout = LAYOUT_NAMES[layoutAppearanceRow.selected] || 'list';
            let overrides = {};
            try {
                overrides = JSON.parse(settings.get_string('layout-appearance-overrides') || '{}');
            } catch {
                // Invalid stored data falls back to global values in the runtime resolver.
            }
            const entry = overrides?.[layout] ?? {};
            updatingLayoutAppearance = true;
            layoutScaleRow.value = typeof entry.scale === 'number'
                ? entry.scale : settings.get_double('icon-scale');
            layoutOpacityScale.set_value(typeof entry.opacity === 'number'
                ? entry.opacity : settings.get_double('background-opacity'));
            layoutScaleRow.subtitle = typeof entry.scale === 'number'
                ? 'Custom value; reset to inherit the global icon size'
                : 'Using global icon size';
            layoutOpacityRow.subtitle = typeof entry.opacity === 'number'
                ? 'Custom value; reset to inherit the global opacity'
                : 'Using global opacity';
            updatingLayoutAppearance = false;
        };

        const saveLayoutOverride = (property, value) => {
            if (updatingLayoutAppearance)
                return;
            const layout = LAYOUT_NAMES[layoutAppearanceRow.selected] || 'list';
            const serialized = setLayoutAppearanceOverride(
                settings.get_string('layout-appearance-overrides'),
                layout,
                property,
                value
            );
            settings.set_string('layout-appearance-overrides', serialized);
            refreshLayoutAppearance();
        };

        layoutAppearanceRow.connect('notify::selected', refreshLayoutAppearance);
        layoutScaleRow.connect('notify::value', () => saveLayoutOverride('scale', layoutScaleRow.value));
        layoutOpacityScale.connect('value-changed', () => saveLayoutOverride('opacity', layoutOpacityScale.get_value()));

        const resetLayoutRow = new Adw.ActionRow({
            title: 'Reset layout overrides',
            subtitle: 'Use the global icon size and opacity for this layout',
        });
        const resetLayoutButton = new Gtk.Button({
            label: 'Reset',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        resetLayoutButton.connect('clicked', () => {
            const layout = LAYOUT_NAMES[layoutAppearanceRow.selected] || 'list';
            let serialized = settings.get_string('layout-appearance-overrides');
            serialized = setLayoutAppearanceOverride(serialized, layout, 'scale', null);
            serialized = setLayoutAppearanceOverride(serialized, layout, 'opacity', null);
            settings.set_string('layout-appearance-overrides', serialized);
            refreshLayoutAppearance();
        });
        resetLayoutRow.add_suffix(resetLayoutButton);
        layoutAppearanceGroup.add(resetLayoutRow);
        refreshLayoutAppearance();
        appearancePage.add(layoutAppearanceGroup);

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
            refreshLayoutAppearance();
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
