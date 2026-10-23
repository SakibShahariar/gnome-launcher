// SPDX-License-Identifier: GPL-2.0-or-later

// Krunner-style dense top bar - archetype #12. Flush to the top edge,
// square top corners, search with a hard divider, compact result rows
// with hairline separators. Centered narrow panel (not full-width) so
// Blur My Shell does not paint a strip across the whole screen.

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
const CARD_WIDTH = 520;

export class KrunnerLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this._settingsMode = false;
        this._settingsResults = [];
        this._settingsSelectedIndex = 0;
        this.position = 'top-flush';
        this.fixedWidth = CARD_WIDTH;
    }

    buildUI() {
        const card = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'launcher-card launcher-krunner-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-color: ${this.theme.outline_variant};`,
        });
        card.set_width(CARD_WIDTH);

        // Search + hard rule underneath (classic KRunner chrome)
        const searchRow = new St.BoxLayout({
            style_class: 'launcher-krunner-search-row',
            style: `border-bottom-color: ${this.theme.outline_variant};`,
            x_expand: true,
        });
        this.entry = new St.Entry({
            style_class: 'launcher-search launcher-krunner-entry',
            style: `color: ${this.theme.on_surface};`,
            hint_text: 'Type to search…',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => this._onTextChanged());
        searchRow.add_child(this.entry);
        card.add_child(searchRow);

        this.resultsBox = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL});
        this.resultsBox.set_width(CARD_WIDTH);
        card.add_child(this.resultsBox);

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
                style_class: selected ? 'launcher-krunner-result-row launcher-result-selected' : 'launcher-krunner-result-row',
                style: selected ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)};` : '',
            });
            row.set_width(CARD_WIDTH);
            row.add_child(new St.Icon({icon_name: 'preferences-system-symbolic', icon_size: Math.round(18 * this.theme.scale), style: `color: ${color}; margin-right: 12px;`}));
            const label = new St.Label({text: item.name, y_align: Clutter.ActorAlign.CENTER, style: `color: ${color};`});
            label.set_width(CARD_WIDTH - 60);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3);
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
            this.resultsBox.add_child(makeRestCard(this.theme, {showFinderHints: true, settingsOnlyHints: true, showRecentApps: true, onActivate: app => { app.activate(); this.dialog.close(); }}));
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
            const isLast = localIndex === apps.length - 1;
            const iconColor = selected
                ? withOpacityText(this.theme.on_primary, this.theme.opacity)
                : this.theme.on_surface_variant;

            let rowStyle = '';
            if (!isLast)
                rowStyle += ` border-bottom-color: ${this.theme.surface_container};`;
            if (selected)
                rowStyle += ` background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)};`;

            const row = new St.BoxLayout({
                reactive: true,
                accessible_name: app.get_name(),
                x_expand: true,
                style_class: isLast
                    ? 'launcher-krunner-result-row'
                    : 'launcher-krunner-result-row launcher-krunner-result-divider',
                style: rowStyle,
            });
            row.set_width(CARD_WIDTH);

            const icon = platedAppIcon(app.get_icon(), Math.round(18 * this.theme.scale), this.theme.surface, {platesEnabled: this.theme.appIconPlates, focused: selected, extraStyle: 'margin-right: 12px;'});
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'launcher-krunner-label',
                style: `color: ${iconColor};`,
            });
            label.set_width(CARD_WIDTH - 60);
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
}
