// SPDX-License-Identifier: GPL-2.0-or-later

// Hero banner with floating mode icons - archetype #14. A banner spans
// the top with the search field embedded in it, plus circular icon
// buttons (apps/run/files/window) floating on it. All four modes are
// wired to real functionality.
//
// Search row: opaque (excluded from global transparency slider).

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

import {windowStart} from './windowing.js';
import {searchFiles, openFile, runCommand, listOpenWindows, activateWindow} from '../modes.js';
import {withOpacity, withOpacityText, withSelectedOpacity, resolveWallpaperUri} from '../theme.js';

const MAX_RESULTS = 6;
const MODES = [
    ['apps', 'view-grid-symbolic', 'Search', true],
    ['run', 'utilities-terminal-symbolic', 'Type a command, Enter to run', true],
    ['files', 'folder-symbolic', 'Search files', true],
    ['window', 'view-list-symbolic', 'Switch windows', true],
];

export class HeroBannerLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.mode = 'apps';
        this._modeResults = [];
        this._modeSelectedIndex = 0;
        this._fileSearchCancellable = null;
    }

    buildUI() {
        const card = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 20px; ` +
                   `border: 1px solid ${this.theme.outline_variant};`,
        });
        card.set_width(460);

        // Banner: single vertical box with wallpaper as CSS background
        // (previous "overlay" used a horizontal BoxLayout so wallpaper and
        // content sat side-by-side instead of stacked).
        const wallpaperUri = resolveWallpaperUri(this.theme.wallpaperPath);
        let bannerStyle = 'border-radius: 20px 20px 0 0; padding: 14px 16px; spacing: 12px;';
        if (wallpaperUri) {
            bannerStyle += ` background-image: url("${wallpaperUri}");` +
                ' background-size: cover; background-position: center; background-repeat: no-repeat;';
        } else {
            bannerStyle += ` background-color: ${withOpacity(this.theme.primary_container, 0.45)};`;
        }

        this.banner = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style: bannerStyle,
        });
        // Give the banner a stable minimum height so mode icons don't collapse
        this.banner.set_height(110);

        const searchRow = new St.BoxLayout({
            x_expand: true,
            style: `background-color: ${withOpacity(this.theme.surface, Math.max(this.theme.opacity, 0.85))}; ` +
                   'border-radius: 16px; padding: 8px 14px; ' +
                   `border: 1px solid ${this.theme.outline_variant};`,
        });
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 14px;`,
            hint_text: 'Search',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => this._onTextChanged());
        searchRow.add_child(this.entry);
        this.banner.add_child(searchRow);

        // Mode icons centered under the search field
        const iconsRow = new St.BoxLayout({
            style: 'spacing: 10px;',
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        this._modeCircles = [];
        for (const [modeId, iconName, , enabled] of MODES) {
            const active = modeId === this.mode;
            const circle = new St.Bin({
                reactive: enabled,
                style: active
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 999px; padding: 10px;`
                    : `background-color: ${withOpacity(this.theme.surface, 0.55)}; ` +
                      `border-radius: 999px; padding: 10px;${enabled ? '' : ' opacity: 0.5;'}`,
            });
            const icon = new St.Icon({
                icon_name: iconName,
                icon_size: Math.round(16 * this.theme.scale),
                style: `color: ${active ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface};`,
            });
            circle.set_child(icon);
            if (enabled) {
                circle.connect('button-press-event', () => {
                    this._switchMode(modeId);
                    return Clutter.EVENT_STOP;
                });
            }
            this._modeCircles.push({modeId, circle, icon});
            iconsRow.add_child(circle);
        }
        this.banner.add_child(iconsRow);
        card.add_child(this.banner);

        this.resultsBox = new St.BoxLayout({
            vertical: true,
            style: 'padding: 6px 8px 10px; spacing: 2px;',
        });
        card.add_child(this.resultsBox);

        return card;
    }

    _switchMode(modeId) {
        if (this.mode === modeId)
            return;
        this.mode = modeId;
        this._modeResults = [];
        this._modeSelectedIndex = 0;

        for (const {modeId: id, circle, icon} of this._modeCircles) {
            const active = id === modeId;
            const entry = MODES.find(m => m[0] === id);
            const enabled = entry[3];
            circle.style = active
                ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 999px; padding: 10px;`
                : `background-color: ${withOpacity(this.theme.surface, 0.55)}; ` +
                  `border-radius: 999px; padding: 10px;${enabled ? '' : ' opacity: 0.5;'}`;
            icon.style = `color: ${active ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface};`;
        }

        const modeInfo = MODES.find(m => m[0] === modeId);
        this.entry.set_hint_text(modeInfo ? modeInfo[2] : 'Search');
        this.entry.set_text('');

        if (modeId === 'apps')
            this.dialog.onQueryChanged('');
        else
            this.renderResults();
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

    // -- keyboard overrides for non-apps modes, see launcherDialog.js --

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

    _renderApps() {
        this.resultsBox.destroy_all_children();
        const total = this.dialog._filtered.length;
        this._windowStart = windowStart(this._windowStart, this.dialog._selectedIndex, total, MAX_RESULTS);
        const start = this._windowStart;
        const apps = this.dialog._filtered.slice(start, start + MAX_RESULTS);
        apps.forEach((app, localIndex) => {
            const index = start + localIndex;
            const selected = index === this.dialog._selectedIndex;
            const row = new St.BoxLayout({
                reactive: true,
                x_expand: true,
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 8px 10px;`
                    : 'border-radius: 12px; padding: 8px 10px;',
            });
            const icon = new St.Icon({gicon: app.get_icon(), icon_size: Math.round(16 * this.theme.scale), style: 'margin-right: 10px;'});
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${selected ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant}; font-size: 13px; font-weight: bold;`,
            });
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
        const row = new St.BoxLayout({
            style: `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 8px 10px;`,
        });
        const icon = new St.Icon({icon_name: 'utilities-terminal-symbolic', icon_size: Math.round(16 * this.theme.scale), style: 'margin-right: 10px;'});
        const label = new St.Label({
            text: text ? `Run: ${text}` : 'Type a command…',
            y_align: Clutter.ActorAlign.CENTER,
            style: `color: ${withOpacityText(this.theme.on_primary, this.theme.opacity)}; font-size: 13px; font-weight: bold;`,
        });
        row.add_child(icon);
        row.add_child(label);
        this.resultsBox.add_child(row);
    }

    _renderFileResults() {
        this.resultsBox.destroy_all_children();

        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(new St.Label({
                text: 'Type to search files',
                style: `color: ${this.theme.muted}; font-size: 12px; padding: 8px 10px;`,
            }));
            return;
        }

        this._modeResults.slice(0, MAX_RESULTS).forEach((item, index) => {
            const selected = index === this._modeSelectedIndex;
            const row = new St.BoxLayout({
                reactive: true,
                x_expand: true,
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 8px 10px;`
                    : 'border-radius: 12px; padding: 8px 10px;',
            });
            const iconColor = selected
                ? withOpacityText(this.theme.on_primary, this.theme.opacity)
                : this.theme.on_surface_variant;
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
            label.set_width(320);
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
        // Populate on first show (switch to mode with empty results)
        if (this._modeResults.length === 0)
            this._modeResults = listOpenWindows();

        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(new St.Label({
                text: 'No open windows',
                style: `color: ${this.theme.muted}; font-size: 12px; padding: 8px 10px;`,
            }));
            return;
        }

        this._modeResults.slice(0, MAX_RESULTS).forEach((item, index) => {
            const selected = index === this._modeSelectedIndex;
            const row = new St.BoxLayout({
                reactive: true,
                x_expand: true,
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 8px 10px;`
                    : 'border-radius: 12px; padding: 8px 10px;',
            });
            const iconColor = selected
                ? withOpacityText(this.theme.on_primary, this.theme.opacity)
                : this.theme.on_surface_variant;
            const icon = item.app
                ? new St.Icon({gicon: item.app.get_icon(), icon_size: Math.round(16 * this.theme.scale), style: `margin-right: 10px; color: ${iconColor};`})
                : new St.Icon({icon_name: 'window-symbolic', icon_size: Math.round(16 * this.theme.scale), style: `margin-right: 10px; color: ${iconColor};`});
            const label = new St.Label({
                text: item.name,
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${iconColor}; font-size: 13px; font-weight: bold;`,
            });
            label.set_width(320);
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