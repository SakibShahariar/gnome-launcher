// SPDX-License-Identifier: GPL-2.0-or-later

// Adaptive width layout - archetype #11. Deliberately no set_width()
// anywhere - the card's natural size follows however many tiles actually
// exist. One match makes a narrow panel; several widen it. St's layout
// system handles this automatically as long as nothing forces a fixed
// width, unlike every other layout in this set.

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';
import {withOpacity} from '../theme.js';

const MAX_RESULTS = 6;

export class AdaptiveWidthLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
    }

    buildUI() {
        const card = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 20px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 4px;`,
        });
        // No set_width() call - width tracks content naturally.

        const searchRow = new St.BoxLayout({style: 'padding: 12px 14px;'});
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 15px;`,
            hint_text: 'Search',
            can_focus: true,
        });
        searchRow.add_child(this.entry);
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        card.add_child(searchRow);

        this.tilesRow = new St.BoxLayout({
            style: 'spacing: 8px; padding: 4px 14px 16px;',
        });
        card.add_child(this.tilesRow);

        return card;
    }

    renderResults() {
        this.tilesRow.destroy_all_children();
        const total = this.dialog._filtered.length;
        this._windowStart = windowStart(this._windowStart, this.dialog._selectedIndex, total, MAX_RESULTS);
        const start = this._windowStart;
        const apps = this.dialog._filtered.slice(start, start + MAX_RESULTS);
        apps.forEach((app, localIndex) => {
            const index = start + localIndex;
            const selected = index === this.dialog._selectedIndex;
            const tile = new St.BoxLayout({
                vertical: true,
                reactive: true,
                style: selected
                    ? `background-color: ${this.theme.primary}; border-radius: 12px; padding: 10px 6px;`
                    : 'border-radius: 12px; padding: 10px 6px;',
            });
            tile.set_width(76);

            const icon = new St.Icon({gicon: app.get_icon(), icon_size: Math.round(24 * this.theme.scale), x_align: Clutter.ActorAlign.CENTER});
            const label = new St.Label({
                text: app.get_name(),
                x_align: Clutter.ActorAlign.CENTER,
                style: `color: ${selected ? this.theme.on_primary : this.theme.on_surface_variant}; ` +
                       'font-size: 10px; text-align: center;',
            });
            label.set_width(70);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3);

            tile.add_child(icon);
            tile.add_child(label);
            tile.connect('button-press-event', () => {
                this.dialog.launchIndex(index);
                return Clutter.EVENT_STOP;
            });
            this.tilesRow.add_child(tile);
        });
    }
}