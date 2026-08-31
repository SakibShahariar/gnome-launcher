// SPDX-License-Identifier: GPL-2.0-or-later

// Split panel with mode-tab pills - archetype #13. Left column: search,
// accent (wallpaper), mode tabs (Apps / Run / Files / Window). Right
// column: results for the active mode.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

import {windowStart} from './windowing.js';
import {searchFiles, openFile, runCommand, listOpenWindows, activateWindow} from '../modes.js';
import {withOpacity, withOpacityText, withSelectedOpacity, resolveWallpaperUri} from '../theme.js';
import {makeEmptyLabel} from '../emptyState.js';

const MAX_RESULTS = 7;
const CARD_WIDTH = 660;
const MODES = [
    ['apps', 'APPS', 'Search apps', true],
    ['run', 'RUN', 'Type a command, Enter to run', true],
    ['files', 'FILES', 'Search files', true],
    ['window', 'WINDOW', 'Switch windows', true],
];

export class SplitTabsLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.mode = 'apps';
        this._modeResults = [];
        this._modeSelectedIndex = 0;
        this._fileSearchCancellable = null;
        this.fixedWidth = CARD_WIDTH;
    }

    buildUI() {
        const outer = new St.BoxLayout({
            style_class: 'launcher-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 20px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 14px; spacing: 14px;`,
        });
        outer.set_width(CARD_WIDTH);

        const left = new St.BoxLayout({vertical: true, style: 'spacing: 10px;'});
        left.set_width(250);

        // Search in a visible field
        const searchRow = new St.BoxLayout({
            style: `background-color: ${withOpacity(this.theme.surface_container, this.theme.opacity)}; ` +
                   'border-radius: 12px; padding: 8px 12px;',
            x_expand: true,
        });
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 14px;`,
            hint_text: 'Search apps',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => this._onTextChanged());
        searchRow.add_child(this.entry);
        left.add_child(searchRow);

        // Accent / wallpaper panel
        const wallpaperUri = resolveWallpaperUri(this.theme.wallpaperPath);
        let accentStyle = 'border-radius: 14px;';
        if (wallpaperUri) {
            accentStyle += ` background-image: url("${wallpaperUri}");` +
                ' background-size: cover; background-position: center; background-repeat: no-repeat;';
        } else {
            accentStyle += ` background-color: ${withOpacity(this.theme.primary_container, 0.55)};`;
        }
        this.accent = new St.Widget({
            x_expand: true,
            style: accentStyle,
        });
        this.accent.set_height(110);
        left.add_child(this.accent);

        // Mode tab pills
        const tabs = new St.BoxLayout({style: 'spacing: 6px;'});
        this._tabWidgets = [];
        MODES.forEach(([modeId, label, , enabled]) => {
            const active = modeId === this.mode;
            const tab = new St.Bin({
                x_expand: true,
                reactive: enabled,
                style: active
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 10px; padding: 8px 4px;`
                    : `background-color: ${withOpacity(this.theme.surface_container, this.theme.opacity)}; border-radius: 10px; padding: 8px 4px;`,
            });
            const tabLabel = new St.Label({
                text: label,
                x_align: Clutter.ActorAlign.CENTER,
                style: `color: ${active ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant}; font-size: 10px; font-weight: bold;`,
            });
            tab.set_child(tabLabel);
            if (enabled) {
                tab.connect('button-press-event', () => {
                    this._switchMode(modeId);
                    return Clutter.EVENT_STOP;
                });
            }
            this._tabWidgets.push({modeId, tab, tabLabel});
            tabs.add_child(tab);
        });
        left.add_child(tabs);
        outer.add_child(left);

        // Results column
        this.resultsBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style: `background-color: ${withOpacity(this.theme.surface_container, Math.min(this.theme.opacity, 0.35))}; ` +
                   'border-radius: 14px; padding: 8px; spacing: 2px;',
        });
        outer.add_child(this.resultsBox);

        return outer;
    }

    _switchMode(modeId) {
        if (this.mode === modeId)
            return;
        this.mode = modeId;
        this._modeResults = [];
        this._modeSelectedIndex = 0;

        for (const {modeId: id, tab, tabLabel} of this._tabWidgets) {
            const active = id === modeId;
            tab.style = active
                ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 10px; padding: 8px 4px;`
                : `background-color: ${withOpacity(this.theme.surface_container, this.theme.opacity)}; border-radius: 10px; padding: 8px 4px;`;
            tabLabel.style = `color: ${active ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant}; font-size: 10px; font-weight: bold;`;
        }

        const modeInfo = MODES.find(m => m[0] === modeId);
        this.entry.set_hint_text(modeInfo ? modeInfo[2] : 'Search');
        this.entry.set_text('');

        if (modeId === 'apps')
            this.dialog.onQueryChanged('');
        else if (modeId === 'window') {
            this._modeResults = listOpenWindows();
            this.renderResults();
        } else {
            this.renderResults();
        }
    }

    async _onTextChanged() {
        const text = this.entry.get_text();

        if (this.mode === 'apps') {
            this.dialog.onQueryChanged(text);
            return;
        }

        if (this.mode === 'run') {
            this.renderResults();
            return;
        }

        if (this.mode === 'files') {
            if (this._fileSearchCancellable)
                this._fileSearchCancellable.cancel();
            const cancellable = new Gio.Cancellable();
            this._fileSearchCancellable = cancellable;

            const results = await searchFiles(text, cancellable);
            if (cancellable.is_cancelled())
                return;

            this._modeResults = results.map(f => ({name: f.name, path: f.path}));
            this._modeSelectedIndex = 0;
            this.renderResults();
            return;
        }

        if (this.mode === 'window') {
            const q = text.trim().toLowerCase();
            let wins = listOpenWindows();
            if (q)
                wins = wins.filter(w => w.name.toLowerCase().includes(q));
            this._modeResults = wins;
            this._modeSelectedIndex = 0;
            this.renderResults();
        }
    }

    onMoveSelection(delta) {
        if (this.mode === 'apps') {
            this.dialog.moveSelection(delta);
            return;
        }
        if ((this.mode !== 'files' && this.mode !== 'window') || this._modeResults.length === 0)
            return;
        const count = this._modeResults.length;
        this._modeSelectedIndex = (this._modeSelectedIndex + delta + count) % count;
        this.renderResults();
    }

    onEnter() {
        if (this.mode === 'apps') {
            this.dialog.launchSelected();
        } else if (this.mode === 'run') {
            runCommand(this.entry.get_text());
            this.dialog.close();
        } else if (this.mode === 'files') {
            const item = this._modeResults[this._modeSelectedIndex];
            if (item) {
                openFile(item.path);
                this.dialog.close();
            }
        } else if (this.mode === 'window') {
            const item = this._modeResults[this._modeSelectedIndex];
            if (item) {
                activateWindow(item.window);
                this.dialog.close();
            }
        }
    }

    renderResults() {
        if (this.mode === 'apps')
            this._renderApps();
        else if (this.mode === 'run')
            this._renderRunPreview();
        else if (this.mode === 'files')
            this._renderFileResults();
        else if (this.mode === 'window')
            this._renderWindowResults();
    }

    _rowStyle(selected) {
        return selected
            ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 8px 12px;`
            : 'border-radius: 12px; padding: 8px 12px;';
    }

    _iconColor(selected) {
        return selected
            ? withOpacityText(this.theme.on_primary, this.theme.opacity)
            : this.theme.on_surface_variant;
    }

    _renderApps() {
        this.resultsBox.destroy_all_children();
        const total = this.dialog._filtered.length;
        if (total === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme));
            return;
        }
        this._windowStart = windowStart(this._windowStart, this.dialog._selectedIndex, total, MAX_RESULTS);
        const start = this._windowStart;
        const apps = this.dialog._filtered.slice(start, start + MAX_RESULTS);
        apps.forEach((app, localIndex) => {
            const index = start + localIndex;
            const selected = index === this.dialog._selectedIndex;
            const iconColor = this._iconColor(selected);
            const row = new St.BoxLayout({
                reactive: true,
                x_expand: true,
                style: this._rowStyle(selected),
            });
            const icon = new St.Icon({
                gicon: app.get_icon(),
                icon_size: Math.round(16 * this.theme.scale),
                style: `margin-right: 10px; color: ${iconColor};`,
            });
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${iconColor}; font-size: 13px; font-weight: bold;`,
            });
            label.set_width(300);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3);
            row.add_child(icon);
            row.add_child(label);
            row.connect('button-press-event', () => {
                this.dialog.launchIndex(index);
                return Clutter.EVENT_STOP;
            });
            this.resultsBox.add_child(row);
        });
    }

    _renderRunPreview() {
        this.resultsBox.destroy_all_children();
        const text = this.entry.get_text().trim();
        const iconColor = withOpacityText(this.theme.on_primary, this.theme.opacity);
        const row = new St.BoxLayout({
            style: this._rowStyle(true),
        });
        const icon = new St.Icon({
            icon_name: 'utilities-terminal-symbolic',
            icon_size: Math.round(16 * this.theme.scale),
            style: `margin-right: 10px; color: ${iconColor};`,
        });
        const label = new St.Label({
            text: text ? `Run: ${text}` : 'Type a command…',
            y_align: Clutter.ActorAlign.CENTER,
            style: `color: ${iconColor}; font-size: 13px; font-weight: bold;`,
        });
        row.add_child(icon);
        row.add_child(label);
        this.resultsBox.add_child(row);
    }

    _renderFileResults() {
        this.resultsBox.destroy_all_children();
        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, 'Type to search files'));
            return;
        }

        this._modeResults.slice(0, MAX_RESULTS).forEach((item, index) => {
            const selected = index === this._modeSelectedIndex;
            const iconColor = this._iconColor(selected);
            const row = new St.BoxLayout({
                reactive: true,
                x_expand: true,
                style: this._rowStyle(selected),
            });
            const icon = new St.Icon({
                icon_name: 'text-x-generic-symbolic',
                icon_size: Math.round(16 * this.theme.scale),
                style: `margin-right: 10px; color: ${iconColor};`,
            });
            const label = new St.Label({
                text: item.name,
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${iconColor}; font-size: 13px; font-weight: bold;`,
            });
            label.set_width(300);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3);
            row.add_child(icon);
            row.add_child(label);
            row.connect('button-press-event', () => {
                openFile(item.path);
                this.dialog.close();
                return Clutter.EVENT_STOP;
            });
            this.resultsBox.add_child(row);
        });
    }

    _renderWindowResults() {
        this.resultsBox.destroy_all_children();
        if (this._modeResults.length === 0)
            this._modeResults = listOpenWindows();

        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, 'No open windows'));
            return;
        }

        this._modeResults.slice(0, MAX_RESULTS).forEach((item, index) => {
            const selected = index === this._modeSelectedIndex;
            const iconColor = this._iconColor(selected);
            const row = new St.BoxLayout({
                reactive: true,
                x_expand: true,
                style: this._rowStyle(selected),
            });
            const icon = item.app
                ? new St.Icon({gicon: item.app.get_icon(), icon_size: Math.round(16 * this.theme.scale), style: `margin-right: 10px; color: ${iconColor};`})
                : new St.Icon({icon_name: 'window-symbolic', icon_size: Math.round(16 * this.theme.scale), style: `margin-right: 10px; color: ${iconColor};`});
            const label = new St.Label({
                text: item.name,
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${iconColor}; font-size: 13px; font-weight: bold;`,
            });
            label.set_width(300);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3);
            row.add_child(icon);
            row.add_child(label);
            row.connect('button-press-event', () => {
                activateWindow(item.window);
                this.dialog.close();
                return Clutter.EVENT_STOP;
            });
            this.resultsBox.add_child(row);
        });
    }
}
