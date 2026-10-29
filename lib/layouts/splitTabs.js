// SPDX-License-Identifier: GPL-2.0-or-later

// Split panel with mode-tab pills - archetype #13. Left column: search,
// accent (wallpaper), mode tabs (Apps / Run / Files / Window). Right
// column: results for the active mode.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {windowStart} from './windowing.js';
import {applyFinderPrefix} from '../finderPrefixController.js';
import {resetModeState} from '../modeController.js';
import {searchModeResults} from '../modeSearch.js';
import {createModeSearchDependencies} from '../modeSearchRuntime.js';
import {activateModeResultForDialog} from '../modeActivationRuntime.js';
import {searchFiles, openFile, runCommand, runCommandInTerminal, activateWindow, openWebSearch, openRecentFile, listOpenWindows, openSettingsPanel} from '../modes.js';
import * as ClipboardHistory from '../clipboardHistory.js';
import {searchClipboardEntries} from '../clipboardSearch.js';
import {copyTextAsQr} from '../clipboardQr.js';
import {withOpacity, withOpacityText, withSelectedOpacity, resolveWallpaperUri, platedAppIcon} from '../theme.js';
import {makeEmptyLabel} from '../emptyState.js';
import {getModeEmptyMessage} from '../emptyStateMessage.js';
import {makeRestCard} from '../restCard.js';
import {cancelPendingFileSearch, scheduleFileSearch} from '../fileSearchLifecycle.js';

const MAX_RESULTS = 7;
const CARD_WIDTH = 660;
const MODES = [
    ['apps', 'APPS', 'Search apps', true],
    ['run', 'RUN', 'Enter to run · Ctrl+Enter in terminal', true],
    ['files', 'FILES', 'Search files', true],
    ['window', 'WINDOW', 'Switch windows', true],
    ['clipboard', 'CLIPBOARD', 'Clipboard history', true],
    ['calculator', 'CALC', 'Calculate · Enter copies result', true],
    ['web', 'WEB', 'Search the web', true],
    ['recent', 'RECENT', 'Recent documents', true],
    ['emoji', 'EMOJI', 'Search emoji', true],
    ['settings', 'SETTINGS', 'GNOME Settings', true],
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
            style_class: 'launcher-card launcher-split-tabs-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-color: ${this.theme.outline_variant};`,
        });
        outer.set_width(CARD_WIDTH);

        const left = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'launcher-split-tabs-left'});
        left.set_width(250);

        // Search in a visible field
        const searchRow = new St.BoxLayout({
            style_class: 'launcher-split-tabs-search-row',
            style: `background-color: ${withOpacity(this.theme.surface_container, this.theme.opacity)};`,
            x_expand: true,
        });
        this.entry = new St.Entry({
            style_class: 'launcher-search launcher-search-entry launcher-split-tabs-entry',
            style: `color: ${this.theme.on_surface};`,
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
        const tabs = new St.BoxLayout({style_class: 'launcher-split-tabs-pills'});
        this._tabWidgets = [];
        MODES.forEach(([modeId, label, , enabled]) => {
            const active = modeId === this.mode;
            const tab = new St.Bin({
                x_expand: true,
                reactive: enabled,
                style_class: active ? 'launcher-split-tabs-pill launcher-result-selected' : 'launcher-split-tabs-pill',
                style: active
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)};`
                    : `background-color: ${withOpacity(this.theme.surface_container, this.theme.opacity)};`,
            });
            const tabLabel = new St.Label({
                text: label,
                x_align: Clutter.ActorAlign.CENTER,
                style_class: 'launcher-split-tabs-pill-label',
                style: `color: ${active ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant};`,
            });
            tab.set_child(tabLabel);
            if (enabled) {
                tab.connect('button-press-event', (_actor, event) => {
                    if (event.get_button() !== Clutter.BUTTON_PRIMARY)
                        return Clutter.EVENT_STOP;
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
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            style_class: 'launcher-split-tabs-results',
            style: `background-color: ${withOpacity(this.theme.surface_container, Math.min(this.theme.opacity, 0.35))};`,
        });
        outer.add_child(this.resultsBox);

        return outer;
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

        for (const {modeId: id, tab, tabLabel} of this._tabWidgets) {
            const active = id === modeId;
            tab.style_class = active ? 'launcher-split-tabs-pill launcher-result-selected' : 'launcher-split-tabs-pill';
            tab.style = active
                ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)};`
                : `background-color: ${withOpacity(this.theme.surface_container, this.theme.opacity)};`;
            tabLabel.style = `color: ${active ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant};`;
        }

        const modeInfo = MODES.find(m => m[0] === modeId);
        this.entry.set_hint_text(modeInfo ? modeInfo[2] : 'Search');
        this.entry.set_text('');

        if (modeId === 'apps') {
            this.dialog.onQueryChanged('');
        } else if (modeId === 'clipboard') {
            this._refreshClipboardResults('');
        } else {
            const results = searchModeResults(modeId, '', createModeSearchDependencies(this.dialog));
            if (results !== null)
                this._modeResults = results;
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

        const modeResults = searchModeResults(this.mode, text, createModeSearchDependencies(this.dialog));
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

    onMoveSelection(delta) {
        if (this.mode === 'apps') {
            if (this.entry.get_text().trim())
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
            if (this.entry.get_text().trim())
                this.dialog.launchSelected();
            return;
        }
        if (this.mode === 'run') {
            if (runCommand(this.entry.get_text()))
                this.dialog.close();
            return;
        }
        activateModeResultForDialog(this.dialog, this._modeResults[this._modeSelectedIndex]);
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

    _rowStyle(selected) {
        return selected
            ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)};`
            : '';
    }

    _iconColor(selected) {
        return selected
            ? withOpacityText(this.theme.on_primary, this.theme.opacity)
            : this.theme.on_surface_variant;
    }

    _renderSettingsResults() {
        this.resultsBox.destroy_all_children();
        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, getModeEmptyMessage('settings')));
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
            this.resultsBox.add_child(makeEmptyLabel(this.theme, getModeEmptyMessage('emoji')));
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
            this.resultsBox.add_child(makeEmptyLabel(this.theme, getModeEmptyMessage('recent')));
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
            this.resultsBox.add_child(makeEmptyLabel(this.theme, getModeEmptyMessage('web')));
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
            this.resultsBox.add_child(makeEmptyLabel(this.theme, getModeEmptyMessage('calculator')));
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
            const iconColor = this._iconColor(selected);
            const row = new St.BoxLayout({
                reactive: true,
                accessible_name: app.get_name(),
                x_expand: true,
                style_class: selected ? 'launcher-mode-result-row launcher-result-selected' : 'launcher-mode-result-row',
                style: this._rowStyle(selected),
            });
            const icon = platedAppIcon(app.get_icon(), Math.round(16 * this.theme.scale), this.theme.surface, {platesEnabled: this.theme.appIconPlates, focused: selected, extraStyle: 'margin-right: 10px;'});
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'launcher-mode-result-label',
                style: `color: ${iconColor};`
            });
            label.set_width(300);
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
        const iconColor = withOpacityText(this.theme.on_primary, this.theme.opacity);
        const row = new St.BoxLayout({
            style_class: 'launcher-mode-result-row launcher-result-selected',
                style: this._rowStyle(true),
        });
        const icon = new St.Icon({
            icon_name: 'utilities-terminal-symbolic',
            icon_size: Math.round(16 * this.theme.scale),
            style_class: 'launcher-mode-result-icon',
                style: `color: ${iconColor};`
        });
        const label = new St.Label({
            text: text ? `Run: ${text}` : 'Type a command…',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'launcher-mode-result-label',
                style: `color: ${iconColor};`
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
            this.resultsBox.add_child(makeEmptyLabel(this.theme, getModeEmptyMessage('files')));
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
            label.set_width(300);
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
            this.resultsBox.add_child(makeEmptyLabel(this.theme, getModeEmptyMessage('clipboard', {clipboardEnabled: false})));
            return;
        }
        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, getModeEmptyMessage('clipboard')));
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
        if (this._modeResults.length === 0)
            this._modeResults = listOpenWindows(this.dialog._settings.get_boolean('windows-all-workspaces'));

        if (this._modeResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, getModeEmptyMessage('window')));
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
            const icon = item.app
                ? platedAppIcon(item.app.get_icon(), Math.round(16 * this.theme.scale), this.theme.surface, {platesEnabled: this.theme.appIconPlates, focused: selected, extraStyle: 'margin-right: 10px;'})
                : new St.Icon({icon_name: 'window-symbolic', icon_size: Math.round(16 * this.theme.scale), style_class: 'launcher-mode-result-icon', style: `color: ${iconColor};`});
            const label = new St.Label({
                text: item.name,
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'launcher-mode-result-label',
                style: `color: ${iconColor};`
            });
            label.set_width(300);
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
