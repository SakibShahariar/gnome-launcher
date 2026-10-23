// SPDX-License-Identifier: GPL-2.0-or-later

// Hero banner with floating mode icons - archetype #14. A banner spans
// the top with the search field embedded in it, plus circular icon
// buttons (apps/run/files/window) floating on it. All four modes are
// wired to real functionality.
//
// Search row: soft glass over the banner (follows global opacity).

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {windowStart} from './windowing.js';
import {applyFinderPrefix} from '../finderPrefixController.js';
import {resetModeState} from '../modeController.js';
import {searchEmoji} from '../emojiFinder.js';
import {evaluateCalculatorInput} from '../calculator.js';
import {searchModeResults} from '../modeSearch.js';
import {searchFiles, openFile, runCommand, runCommandInTerminal, listOpenWindows, activateWindow, openWebSearch, searchRecentFiles, openRecentFile, searchSettingsPanels, openSettingsPanel} from '../modes.js';
import * as ClipboardHistory from '../clipboardHistory.js';
import {searchClipboardEntries} from '../clipboardSearch.js';
import {copyTextAsQr} from '../clipboardQr.js';
import {withOpacity, withOpacityText, withSelectedOpacity, resolveWallpaperUri, platedAppIcon} from '../theme.js';
import {makeEmptyLabel} from '../emptyState.js';
import {makeRestCard} from '../restCard.js';
import {cancelPendingFileSearch, scheduleFileSearch} from '../fileSearchLifecycle.js';

const MAX_RESULTS = 6;
const MODES = [
    ['apps', 'view-grid-symbolic', 'Search', true],
    ['run', 'utilities-terminal-symbolic', 'Enter to run · Ctrl+Enter in terminal', true],
    ['files', 'folder-symbolic', 'Search files', true],
    ['window', 'view-list-symbolic', 'Switch windows', true],
    ['clipboard', 'edit-paste-symbolic', 'Clipboard history', true],
    ['calculator', 'accessories-calculator-symbolic', 'Calculate · Enter copies result', true],
    ['web', 'web-browser-symbolic', 'Search the web', true],
    ['recent', 'document-open-recent-symbolic', 'Recent documents', true],
    ['emoji', 'face-smile-symbolic', 'Search emoji', true],
    ['settings', 'preferences-system-symbolic', 'GNOME Settings', true],
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
        this.fixedWidth = 460;
    }

    buildUI() {
        const card = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'launcher-card launcher-hero-banner-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-color: ${this.theme.outline_variant};`,
        });
        card.set_width(460);

        // Banner: single vertical box with wallpaper as CSS background
        // (previous "overlay" used a horizontal BoxLayout so wallpaper and
        // content sat side-by-side instead of stacked).
        const wallpaperUri = resolveWallpaperUri(this.theme.wallpaperPath);
        let bannerStyle = '';
        if (wallpaperUri) {
            bannerStyle += ` background-image: url("${wallpaperUri}");` +
                ' background-size: cover; background-position: center; background-repeat: no-repeat;';
        } else {
            bannerStyle += ` background-color: ${withOpacity(this.theme.primary_container, 0.45)};`;
        }

        this.banner = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            style_class: 'launcher-hero-banner',
            style: bannerStyle,
        });
        // Give the banner a stable minimum height so mode icons don't collapse
        // and don't overlap the first result (image shows cramped/overlap at 128-148)
        this.banner.set_height(160);

        // Soft glass over the banner wallpaper — follow global opacity,
        // with a light floor so text stays readable without going solid.
        // Keep the search control readable even when global opacity is low.
        const searchOpacity = Math.min(Math.max(this.theme.opacity, 0.82), 0.94);
        const searchRow = new St.BoxLayout({
            x_expand: true,
            style_class: 'launcher-hero-search-row',
            style: `background-color: ${withOpacity(this.theme.surface, searchOpacity)}; border-color: ${withOpacity(this.theme.outline_variant, 0.45)};`,
        });
        this.entry = new St.Entry({
            style_class: 'launcher-search launcher-hero-entry',
            style: `color: ${this.theme.on_surface};`,
            hint_text: 'Search',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => this._onTextChanged());
        searchRow.add_child(this.entry);
        this.banner.add_child(searchRow);

        // Mode icons centered under the search field
        const iconsRow = new St.BoxLayout({
            style_class: 'launcher-hero-icons-row',
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        this._modeCircles = [];
        for (const [modeIndex, [modeId, iconName, label, enabled]] of MODES.entries()) {
            const active = modeId === this.mode;
            const circle = new St.Bin({
                style_class: active ? 'launcher-hero-mode-circle launcher-result-selected' : 'launcher-hero-mode-circle',
                reactive: enabled,
                accessible_name: label,
                tooltip_text: `${label} (Ctrl+${modeIndex + 1})`,
                style: this._circleStyle(active, enabled),
            });
            const icon = new St.Icon({
                icon_name: iconName,
                icon_size: Math.round(16 * this.theme.scale),
                style: `color: ${active ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface};`,
            });
            circle.set_child(icon);
            if (enabled) {
                circle.connect('button-press-event', (_actor, event) => {
                    if (event.get_button() !== Clutter.BUTTON_PRIMARY)
                        return Clutter.EVENT_STOP;
                    this._switchMode(modeId);
                    return Clutter.EVENT_STOP;
                });
            }
            this._modeCircles.push({modeId, circle, icon});
            iconsRow.add_child(circle);
        }
        this.banner.add_child(iconsRow);
        card.add_child(this.banner);

        // Hard spacer guarantees gap even if banner height/clipping varies
        const bannerSpacer = new St.Widget({style_class: 'launcher-hero-banner-spacer'});
        card.add_child(bannerSpacer);

        this.resultsBox = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'launcher-hero-results',
        });
        card.add_child(this.resultsBox);

        return card;
    }

    _circleStyle(active, enabled) {
        if (active)
            return `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)};`;
        return `background-color: ${withOpacity(this.theme.surface, 0.82)};${enabled ? '' : ' opacity: 0.5;'}`;
    }

    _rowStyle(selected) {
        return selected
            ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)};`
            : '';
    }

    _cancelFileSearch() {
        cancelPendingFileSearch(this, id => GLib.Source.remove(id));
    }

    onSwitchModeByIndex(index) {
        const mode = MODES[index];
        if (!mode)
            return false;
        this._switchMode(mode[0]);
        return true;
    }

    _switchMode(modeId) {
        if (this.mode === modeId)
            return;
        resetModeState(this, modeId);

        for (const {modeId: id, circle, icon} of this._modeCircles) {
            const active = id === modeId;
            const entry = MODES.find(m => m[0] === id);
            const enabled = entry[3];
            circle.style_class = active ? 'launcher-hero-mode-circle launcher-result-selected' : 'launcher-hero-mode-circle';
            circle.style = this._circleStyle(active, enabled);
            icon.style = `color: ${active ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface};`;
        }

        const modeInfo = MODES.find(m => m[0] === modeId);
        this.entry.set_hint_text(modeInfo ? modeInfo[2] : 'Search');
        this.entry.set_text('');

        if (modeId === 'apps')
            this.dialog.onQueryChanged('');
        else if (modeId === 'window') {
            this._modeResults = listOpenWindows(this.dialog._settings.get_boolean('windows-all-workspaces'));
            this.renderResults();
        } else if (modeId === 'clipboard') {
            this._refreshClipboardResults('');
        } else if (modeId === 'settings') {
            this._modeResults = searchSettingsPanels('');
            this.renderResults();
        } else {
            this.renderResults();
        }
    }

    async _onTextChanged() {
        const text = this.entry.get_text();
        if (applyFinderPrefix(this, text, MODES))
            return;

        if (this.mode === 'apps') {
            this.dialog.onQueryChanged(text);
            return;
        }

        if (this.mode === 'run') {
            this.renderResults();
            return;
        }

        const modeResults = searchModeResults(this.mode, text, {
            searchEmoji,
            searchRecentFiles,
            evaluateCalculatorInput,
            listOpenWindows,
            allWorkspaces: this.dialog._settings.get_boolean('windows-all-workspaces'),
            searchSettingsPanels,
        });
        if (modeResults !== null) {
            this._modeResults = modeResults;
            this._modeSelectedIndex = 0;
            this.renderResults();
            return;
        }






        if (this.mode === 'files') {
            scheduleFileSearch(this, text, {
                removeSource: id => GLib.Source.remove(id),
                scheduleTimeout: callback => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, callback),
                sourceRemove: GLib.SOURCE_REMOVE,
                createCancellable: () => new Gio.Cancellable(),
                search: searchFiles,
                isCurrent: () => this.mode === 'files',
                mapResults: results => results.map(f => ({name: f.name, path: f.path})),
                onResults: results => {
                    this._modeResults = results;
                    this._modeSelectedIndex = 0;
                    this.renderResults();
                },
                onError: e => log(`gnome-launcher: debounced file search failed: ${e}`),
            });
            return;
        }

        if (this.mode === 'clipboard') {
            this._refreshClipboardResults(text);
            return;
        }

    }

    // -- keyboard overrides for non-apps modes, see launcherDialog.js --

    onMoveSelection(delta) {
        if (this.mode === 'apps') {
            this.dialog.moveSelection(delta);
            return;
        }
        if (!['files', 'window', 'clipboard', 'recent', 'emoji', 'settings'].includes(this.mode) || this._modeResults.length === 0)
            return;
        const count = this._modeResults.length;
        this._modeSelectedIndex = (this._modeSelectedIndex + delta + count) % count;
        this.renderResults();
    }

    onRunInTerminal() {
        if (this.mode !== 'run')
            return false;
        if (!runCommandInTerminal(this.entry.get_text(), this.dialog._settings))
            return true; // The run-mode shortcut was handled; keep the dialog open on failure.
        this.dialog.close();
        return true;
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
        } else if (this.mode === 'clipboard') {
            const item = this._modeResults[this._modeSelectedIndex];
            if (item) {
                ClipboardHistory.restoreEntry(item);
                this.dialog.close();
            }
        } else if (this.mode === 'calculator') {
            const item = this._modeResults[this._modeSelectedIndex];
            if (item && item.copyable && item.value !== null) {
                ClipboardHistory.copyToClipboard(item.value);
                this.dialog.close();
            }
        } else if (this.mode === 'web') {
            const item = this._modeResults[this._modeSelectedIndex];
            if (item && openWebSearch(item.query, this.dialog._settings.get_string('search-url-template')))
                this.dialog.close();
        } else if (this.mode === 'recent') {
            const item = this._modeResults[this._modeSelectedIndex];
            if (item && openRecentFile(item.uri))
                this.dialog.close();
        } else if (this.mode === 'emoji') {
            const item = this._modeResults[this._modeSelectedIndex];
            if (item) {
                ClipboardHistory.copyToClipboard(item.emoji);
                this.dialog.close();
            }
        } else if (this.mode === 'settings') {
            const item = this._modeResults[this._modeSelectedIndex];
            if (item && openSettingsPanel(item.id))
                this.dialog.close();
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
        else if (this.mode === 'clipboard')
            this._renderClipboardResults();
        else if (this.mode === 'calculator')
            this._renderCalculatorResults();
        else if (this.mode === 'web')
            this._renderWebResults();
        else if (this.mode === 'recent')
            this._renderRecentResults();
        else if (this.mode === 'emoji')
            this._renderEmojiResults();
        else if (this.mode === 'settings')
            this._renderSettingsResults();
    }

    _renderSettingsResults() {
        this.resultsBox.destroy_all_children();
        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, 'No matching Settings panels'));
            return;
        }
        const start = windowStart(this._modeWindowStart ?? 0, this._modeSelectedIndex, this._modeResults.length, MAX_RESULTS);
        this._modeWindowStart = start;
        this._modeResults.slice(start, start + MAX_RESULTS).forEach((item, index) => {
            const selected = start + index === this._modeSelectedIndex;
            const color = selected ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant;
            const row = new St.BoxLayout({reactive: true, accessible_name: item.name, x_expand: true, style: this._rowStyle(selected)});
            row.add_child(new St.Icon({icon_name: 'preferences-system-symbolic', icon_size: Math.round(16 * this.theme.scale), style: `color: ${color}; margin-right: 10px;`}));
            row.add_child(new St.Label({text: item.name, y_align: Clutter.ActorAlign.CENTER, style: `color: ${color};`}));
            row.connect('button-press-event', (_actor, event) => {
                if (event.get_button() !== Clutter.BUTTON_PRIMARY)
                    return Clutter.EVENT_STOP;
                if (openSettingsPanel(item.id))
                    this.dialog.close();
                return Clutter.EVENT_STOP;
            });
            this.resultsBox.add_child(row);
        });
    }

    _renderEmojiResults() {
        this.resultsBox.destroy_all_children();
        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, 'No matching emoji'));
            return;
        }

        const start = windowStart(this._modeWindowStart ?? 0, this._modeSelectedIndex, this._modeResults.length, MAX_RESULTS);
        this._modeWindowStart = start;
        this._modeResults.slice(start, start + MAX_RESULTS).forEach((item, index) => {
            const selected = start + index === this._modeSelectedIndex;
            const color = selected ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant;
            const row = new St.BoxLayout({
                reactive: true,
                accessible_name: item.name,
                style_class: selected ? 'launcher-mode-result-row launcher-result-selected' : 'launcher-mode-result-row',
                style: selected ? this._rowStyle(true) : this._rowStyle(false),
            });
            row.add_child(new St.Label({
                text: item.emoji,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'launcher-mode-result-emoji',
            }));
            row.add_child(new St.Label({
                text: item.name,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'launcher-mode-result-label',
                style: `color: ${color};`
            }));
            row.connect('button-press-event', (_actor, event) => {
                if (event.get_button() !== Clutter.BUTTON_PRIMARY)
                    return Clutter.EVENT_STOP;
                ClipboardHistory.copyToClipboard(item.emoji);
                this.dialog.close();
                return Clutter.EVENT_STOP;
            });
            this.resultsBox.add_child(row);
        });
        this.resultsBox.add_child(new St.Label({
            text: 'Enter: copy emoji to clipboard',
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'launcher-mode-result-footer',
            style: `color: ${this.theme.muted};`
        }));
    }

    _renderRecentResults() {
        this.resultsBox.destroy_all_children();
        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, 'No recent documents'));
            return;
        }

        const start = windowStart(this._modeWindowStart ?? 0, this._modeSelectedIndex, this._modeResults.length, MAX_RESULTS);
        this._modeWindowStart = start;
        this._modeResults.slice(start, start + MAX_RESULTS).forEach((item, index) => {
            const selected = start + index === this._modeSelectedIndex;
            const color = selected ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant;
            const row = new St.BoxLayout({
                reactive: true,
                accessible_name: item.name,
                style_class: selected ? 'launcher-mode-result-row launcher-result-selected' : 'launcher-mode-result-row',
                style: selected ? this._rowStyle(true) : this._rowStyle(false),
            });
            row.add_child(new St.Icon({
                icon_name: 'document-open-recent-symbolic',
                icon_size: Math.round(16 * this.theme.scale),
                style_class: 'launcher-mode-result-icon',
                style: `color: ${color};`
            }));
            row.add_child(new St.Label({
                text: item.name,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'launcher-mode-result-label',
                style: `color: ${color};`
            }));
            row.connect('button-press-event', (_actor, event) => {
                if (event.get_button() !== Clutter.BUTTON_PRIMARY)
                    return Clutter.EVENT_STOP;
                if (openRecentFile(item.uri))
                    this.dialog.close();
                return Clutter.EVENT_STOP;
            });
            this.resultsBox.add_child(row);
        });
    }

    _renderWebResults() {
        this.resultsBox.destroy_all_children();
        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, 'Type a web search query'));
            return;
        }

        const item = this._modeResults[0];
        const row = new St.BoxLayout({
            style_class: 'launcher-mode-result-row launcher-result-selected',
            style: this._rowStyle(true),
        });
        const color = withOpacityText(this.theme.on_primary, this.theme.opacity);
        row.add_child(new St.Icon({
            icon_name: 'web-browser-symbolic',
            icon_size: Math.round(16 * this.theme.scale),
            style_class: 'launcher-mode-result-icon',
                style: `color: ${color};`
        }));
        row.add_child(new St.Label({
            text: item.name,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'launcher-mode-result-label',
                style: `color: ${color};`
        }));
        this.resultsBox.add_child(row);
        this.resultsBox.add_child(new St.Label({
            text: 'Enter: open search in browser',
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'launcher-mode-result-footer',
            style: `color: ${this.theme.muted};`
        }));
    }

    _renderCalculatorResults() {
        this.resultsBox.destroy_all_children();
        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, 'Type a valid arithmetic expression'));
            return;
        }

        const item = this._modeResults[0];
        const row = new St.BoxLayout({
            style_class: 'launcher-mode-result-row launcher-result-selected',
                style: this._rowStyle(true),
        });
        const color = withOpacityText(this.theme.on_primary, this.theme.opacity);
        row.add_child(new St.Icon({
            icon_name: 'accessories-calculator-symbolic',
            icon_size: Math.round(16 * this.theme.scale),
            style_class: 'launcher-mode-result-icon',
                style: `color: ${color};`
        }));
        const label = new St.Label({
            text: item.name,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'launcher-mode-result-label',
                style: `color: ${color};`
        });
        row.add_child(label);
        this.resultsBox.add_child(row);
        this.resultsBox.add_child(new St.Label({
            text: item.value === null ? 'Currency conversion needs a network rate' : 'Enter: copy result to clipboard',
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'launcher-mode-result-footer',
            style: `color: ${this.theme.muted};`
        }));
    }

    _renderApps() {
        this.resultsBox.destroy_all_children();
        if (!this.entry.get_text().trim()) {
            this.resultsBox.add_child(makeRestCard(this.theme, {showFinderHints: true}));
            return;
        }
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
            const row = new St.BoxLayout({
                reactive: true,
                accessible_name: app.get_name(),
                x_expand: true,
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 8px 10px;`
                    : 'border-radius: 12px; padding: 8px 10px;',
            });
            const iconColor = selected
                ? withOpacityText(this.theme.on_primary, this.theme.opacity)
                : this.theme.on_surface_variant;
            const icon = platedAppIcon(app.get_icon(), Math.round(16 * this.theme.scale), this.theme.surface, {platesEnabled: this.theme.appIconPlates, focused: selected, extraStyle: 'margin-right: 10px;'});
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'launcher-mode-result-label',
                style: `color: ${iconColor};`
            });
            label.set_width(380);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3);
            row.add_child(icon);
            row.add_child(label);
            row.connect('button-press-event', (_actor, event) => {
                if (event.get_button() !== Clutter.BUTTON_PRIMARY)
                    return Clutter.EVENT_STOP;
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
            style_class: 'launcher-mode-run-preview-row launcher-result-selected',
            style: `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)};`
        });
        const iconColor = withOpacityText(this.theme.on_primary, this.theme.opacity);
        const icon = new St.Icon({icon_name: 'utilities-terminal-symbolic', icon_size: Math.round(16 * this.theme.scale), style_class: 'launcher-mode-result-icon', style: `color: ${iconColor};`});
        const label = new St.Label({
            text: text ? `Run: ${text}` : 'Type a command…',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'launcher-mode-result-label',
            style: `color: ${withOpacityText(this.theme.on_primary, this.theme.opacity)};`
        });
        row.add_child(icon);
        row.add_child(label);
        this.resultsBox.add_child(row);

        const hint = new St.Label({
            text: 'Enter: run normally  ·  Ctrl+Enter: run in terminal',
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'launcher-mode-result-footer',
            style: `color: ${this.theme.muted};`
        });
        this.resultsBox.add_child(hint);
    }

    _renderFileResults() {
        this.resultsBox.destroy_all_children();

        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, 'Type to search files'));
            return;
        }

        const start = windowStart(
            this._modeWindowStart ?? 0,
            this._modeSelectedIndex,
            this._modeResults.length,
            MAX_RESULTS
        );
        this._modeWindowStart = start;
        this._modeResults.slice(start, start + MAX_RESULTS).forEach((item, index) => {
            const selected = start + index === this._modeSelectedIndex;
            const row = new St.BoxLayout({
                reactive: true,
                accessible_name: item.name,
                x_expand: true,
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 8px 10px;`
                    : 'border-radius: 12px; padding: 8px 10px;',
            });
            const iconColor = selected
                ? withOpacityText(this.theme.on_primary, this.theme.opacity)
                : this.theme.on_surface_variant;
            const icon = new St.Icon({
                gicon: item.icon ?? Gio.ThemedIcon.new('text-x-generic-symbolic'),
                icon_size: Math.round(16 * this.theme.scale),
                style_class: 'launcher-mode-result-icon',
                style: `color: ${iconColor};`
            });
            const label = new St.Label({
                text: item.name,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'launcher-mode-result-label',
                style: `color: ${iconColor};`
            });
            label.set_width(320);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3);
            row.add_child(icon);
            row.add_child(label);
            row.connect('button-press-event', (_actor, event) => {
                if (event.get_button() !== Clutter.BUTTON_PRIMARY)
                    return Clutter.EVENT_STOP;
                openFile(item.path);
                this.dialog.close();
                return Clutter.EVENT_STOP;
            });
            this.resultsBox.add_child(row);
        });
    }


    _refreshClipboardResults(query) {
        this._modeResults = searchClipboardEntries(
            ClipboardHistory.getEntries(), query,
            this.dialog._settings.get_boolean('clipboard-history-enabled')
        );
        this._modeSelectedIndex = 0;
        this.renderResults();
    }

    _renderClipboardResults() {
        this.resultsBox.destroy_all_children();
        if (!this.dialog._settings.get_boolean('clipboard-history-enabled')) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, 'Clipboard history is off; enable it in Preferences'));
            return;
        }
        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, 'Clipboard is empty'));
            return;
        }
        const start = windowStart(
            this._modeWindowStart ?? 0,
            this._modeSelectedIndex,
            this._modeResults.length,
            MAX_RESULTS
        );
        this._modeWindowStart = start;
        this._modeResults.slice(start, start + MAX_RESULTS).forEach((item, index) => {
            const selected = start + index === this._modeSelectedIndex;
            const iconColor = this._iconColor(selected);
            const row = new St.BoxLayout({
                reactive: true,
                accessible_name: item.name,
                x_expand: true,
                style_class: selected ? 'launcher-mode-result-row launcher-result-selected' : 'launcher-mode-result-row',
                style: this._rowStyle(selected),
            });
            const icon = item.kind === 'clipboard-image'
                ? ClipboardHistory.createImagePreview(item, this.theme.scale)
                : new St.Icon({
                    icon_name: 'edit-paste-symbolic',
                    icon_size: Math.round(16 * this.theme.scale),
                    style_class: 'launcher-mode-result-icon',
                    style: `color: ${iconColor};`
                });
            const label = new St.Label({
                text: item.name,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'launcher-mode-result-label',
                style: `color: ${iconColor};`
            });
            label.set_width(260);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3);
            row.add_child(icon);
            row.add_child(label);
            if (item.kind === 'clipboard' && typeof item.text === 'string') {
                const qrButton = new St.Button({
                    label: 'QR',
                    can_focus: true,
                    accessible_name: 'Copy text as QR image',
                    style_class: 'launcher-clipboard-qr-button',
                });
                qrButton.connect('clicked', () => {
                    if (copyTextAsQr(item.text))
                        this.dialog.close();
                });
                row.add_child(qrButton);
            }
            row.connect('button-press-event', (_actor, event) => {
                if (event.get_button() !== Clutter.BUTTON_PRIMARY)
                    return Clutter.EVENT_STOP;
                ClipboardHistory.restoreEntry(item);
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
            this._modeResults = listOpenWindows(this.dialog._settings.get_boolean('windows-all-workspaces'));

        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, 'No open windows'));
            return;
        }

        const start = windowStart(
            this._modeWindowStart ?? 0,
            this._modeSelectedIndex,
            this._modeResults.length,
            MAX_RESULTS
        );
        this._modeWindowStart = start;
        this._modeResults.slice(start, start + MAX_RESULTS).forEach((item, index) => {
            const selected = start + index === this._modeSelectedIndex;
            const row = new St.BoxLayout({
                reactive: true,
                accessible_name: item.name,
                x_expand: true,
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 8px 10px;`
                    : 'border-radius: 12px; padding: 8px 10px;',
            });
            const iconColor = selected
                ? withOpacityText(this.theme.on_primary, this.theme.opacity)
                : this.theme.on_surface_variant;
            const icon = item.app
                ? platedAppIcon(item.app.get_icon(), Math.round(16 * this.theme.scale), this.theme.surface, {platesEnabled: this.theme.appIconPlates, focused: selected, extraStyle: 'margin-right: 10px;'})
                : new St.Icon({icon_name: 'window-symbolic', icon_size: Math.round(16 * this.theme.scale), style_class: 'launcher-mode-result-icon', style: `color: ${iconColor};`});
            const label = new St.Label({
                text: item.name,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'launcher-mode-result-label',
                style: `color: ${iconColor};`
            });
            label.set_width(320);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3);
            row.add_child(icon);
            row.add_child(label);
            row.connect('button-press-event', (_actor, event) => {
                if (event.get_button() !== Clutter.BUTTON_PRIMARY)
                    return Clutter.EVENT_STOP;
                activateWindow(item.window);
                this.dialog.close();
                return Clutter.EVENT_STOP;
            });
            this.resultsBox.add_child(row);
        });
    }
}
