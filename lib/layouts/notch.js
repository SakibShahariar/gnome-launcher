// SPDX-License-Identifier: GPL-2.0-or-later

// Notch-style layout. Hangs flush against the top-center of the screen
// like a hardware camera notch - narrow and centered, unlike
// top-dropdown which is wider. Rounded only on the bottom corners.
//
// Narrow root + fixedWidth centering (no full-monitor transparent Bin —
// that caused Blur My Shell to blur a full-width strip).

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';
import {withOpacity, withOpacityText, withSelectedOpacity, platedAppIcon} from '../theme.js';
import {makeEmptyLabel} from '../emptyState.js';

const MAX_RESULTS = 6;
const CARD_WIDTH = 380;

export class NotchLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'top-flush';
        this.fixedWidth = CARD_WIDTH;
    }

    buildUI() {
        const card = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'launcher-card launcher-notch-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-color: ${this.theme.outline_variant};`,
        });
        card.set_width(CARD_WIDTH);

        const searchRow = new St.BoxLayout({style_class: 'launcher-notch-search-row'});
        this.entry = new St.Entry({
            style_class: 'launcher-search launcher-search-entry launcher-notch-entry',
            style: `color: ${this.theme.on_surface};`,
            hint_text: 'Search',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        card.add_child(searchRow);

        const divider = new St.Widget({
            style_class: 'launcher-notch-divider',
            style: `background-color: ${withOpacity(this.theme.outline_variant, this.theme.opacity)};`,
            height: 1,
        });
        card.add_child(divider);

        this.resultsBox = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL, style_class: 'launcher-notch-results'});
        this.resultsBox.set_width(CARD_WIDTH);
        card.add_child(this.resultsBox);

        return card;
    }

    renderResults() {
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
            const iconColor = selected
                ? withOpacityText(this.theme.on_primary, this.theme.opacity)
                : this.theme.on_surface_variant;
            const row = new St.BoxLayout({
                reactive: true,
                accessible_name: app.get_name(),
                style_class: selected ? 'launcher-notch-result-row launcher-result-selected' : 'launcher-notch-result-row',
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)};`
                    : '',
            });
            row.set_width(CARD_WIDTH - 12);

            const icon = platedAppIcon(app.get_icon(), Math.round(16 * this.theme.scale), this.theme.surface, {platesEnabled: this.theme.appIconPlates, focused: selected, extraStyle: 'margin-right: 10px;'});
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style_class: 'launcher-notch-label',
                style: `color: ${iconColor};`,
            });
            label.set_width(CARD_WIDTH - 60);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3); // Pango.EllipsizeMode.END

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
