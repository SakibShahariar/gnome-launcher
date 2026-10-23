// SPDX-License-Identifier: GPL-2.0-or-later

// Minimal list layout - archetype #2. St/Clutter port of the standalone
// app's layouts/list.py. One result per row, quiet chrome, selected row
// gets a filled highlight instead of the GTK version's left accent bar
// (simpler to theme reliably in St's more limited CSS dialect).

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';
import {withOpacity, withOpacityText, withSelectedOpacity, platedAppIcon} from '../theme.js';
import {makeEmptyLabel} from '../emptyState.js';
import {makeRestCard} from '../restCard.js';
import {parseFinderPrefix} from '../finderPrefix.js';
import {cancelAppSearch} from '../finderPrefixController.js';
import {searchSettingsPanels, openSettingsPanel} from '../modes.js';

const MAX_RESULTS = 8;

export class ListLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this._settingsMode = false;
        this._settingsResults = [];
        this._settingsSelectedIndex = 0;
    }

    buildUI() {
        const card = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'launcher-card launcher-list-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-color: ${this.theme.outline_variant};`,
        });
        card.set_width(460);

        const searchRow = new St.BoxLayout({
            style_class: 'launcher-list-search-row',
        });
        this.entry = new St.Entry({
            style_class: 'launcher-search launcher-list-entry',
            style: `color: ${this.theme.on_surface};`,
            hint_text: 'Search',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => this._onTextChanged());
        searchRow.add_child(this.entry);
        card.add_child(searchRow);

        this.resultsBox = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'launcher-list-results',
        });
        card.add_child(this.resultsBox);

        this.footer = new St.Label({
            style_class: 'launcher-list-footer',
            style: `color: ${this.theme.muted};`,
        });
        card.add_child(this.footer);

        return card;
    }

    _onTextChanged() {
        const text = this.entry.get_text();
        const prefix = parseFinderPrefix(text);
        if (prefix) {
            if (prefix.mode === 'settings') {
                cancelAppSearch(this.dialog);
                this._settingsMode = true;
                if (this.entry.get_text() !== prefix.query)
                    this.entry.set_text(prefix.query);
                return;
            }
            this._settingsMode = false;
        }

        if (this._settingsMode) {
            this._settingsResults = searchSettingsPanels(text);
            this._settingsSelectedIndex = 0;
            this._windowStart = 0;
            this.renderResults();
            return;
        }

        this.dialog.onQueryChanged(text);
    }

    onMoveSelection(delta) {
        if (!this._settingsMode) {
            if (this.entry.get_text().trim())
                this.dialog.moveSelection(delta);
            return;
        }
        if (this._settingsResults.length === 0)
            return;
        const count = this._settingsResults.length;
        this._settingsSelectedIndex = (this._settingsSelectedIndex + delta + count) % count;
        this.renderResults();
    }

    onEnter() {
        if (!this._settingsMode) {
            if (this.entry.get_text().trim())
                this.dialog.launchSelected();
            return;
        }
        const item = this._settingsResults[this._settingsSelectedIndex];
        if (item && openSettingsPanel(item.id))
            this.dialog.close();
    }

    _renderSettingsResults() {
        if (this._settingsResults.length === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme, 'No matching Settings panels'));
            return;
        }
        this._windowStart = windowStart(this._windowStart, this._settingsSelectedIndex, this._settingsResults.length, MAX_RESULTS);
        const start = this._windowStart;
        this._settingsResults.slice(start, start + MAX_RESULTS).forEach((item, localIndex) => {
            const index = start + localIndex;
            const selected = index === this._settingsSelectedIndex;
            const color = selected
                ? withOpacityText(this.theme.on_primary, this.theme.opacity)
                : this.theme.on_surface_variant;
            const row = new St.BoxLayout({
                reactive: true,
                accessible_name: item.name,
                x_expand: true,
                style_class: selected ? 'launcher-list-result-row launcher-result-selected' : 'launcher-list-result-row',
                style: selected ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)};` : '',
            });
            row.add_child(new St.Icon({icon_name: 'preferences-system-symbolic', icon_size: Math.round(18 * this.theme.scale), style: `color: ${color}; margin-right: 10px;`}));
            const label = new St.Label({text: item.name, y_align: Clutter.ActorAlign.CENTER, style: `color: ${color};`});
            row.add_child(label);
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

    renderResults() {
        this.resultsBox.destroy_all_children();
        if (this._settingsMode) {
            this._renderSettingsResults();
            return;
        }

        if (!this.entry.get_text().trim()) {
            this.resultsBox.add_child(makeRestCard(this.theme, {showFinderHints: true, settingsOnlyHints: true}));
            this.footer.set_text('');
            return;
        }

        const total = this.dialog._filtered.length;
        if (total === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme));
            this.footer.set_text('0 matches');
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
                style_class: selected
                    ? 'launcher-list-result-row launcher-result-selected'
                    : 'launcher-list-result-row',
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)};`
                    : '',
            });

            const icon = platedAppIcon(app.get_icon(), Math.round(18 * this.theme.scale), this.theme.surface, {platesEnabled: this.theme.appIconPlates, focused: selected, extraStyle: 'margin-right: 10px;'});
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'launcher-list-result-label',
                style: `color: ${selected ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant};`,
            });

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

        const count = this.dialog._filtered.length;
        this.footer.set_text(`${count} match${count !== 1 ? 'es' : ''}`);
    }
}