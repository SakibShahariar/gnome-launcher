// SPDX-License-Identifier: GPL-2.0-or-later

// Minimal list layout - archetype #2. St/Clutter port of the standalone
// app's layouts/list.py. One result per row, quiet chrome, selected row
// gets a filled highlight instead of the GTK version's left accent bar
// (simpler to theme reliably in St's more limited CSS dialect).

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';
import {withOpacity, withOpacityText, withSelectedOpacity} from '../theme.js';

const MAX_RESULTS = 8;

export class ListLayout {
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
        card.set_width(460);

        const searchRow = new St.BoxLayout({
            style: 'padding: 12px 14px;',
        });
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 16px;`,
            hint_text: 'Search',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        card.add_child(searchRow);

        this.resultsBox = new St.BoxLayout({vertical: true, style: 'padding: 0 6px 6px;'});
        card.add_child(this.resultsBox);

        this.footer = new St.Label({
            style: `color: ${this.theme.muted}; font-size: 11px; padding: 4px 16px 8px;`,
        });
        card.add_child(this.footer);

        return card;
    }

    renderResults() {
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
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 14px; padding: 8px 12px;`
                    : 'border-radius: 14px; padding: 8px 12px;',
            });

            const icon = new St.Icon({
                gicon: app.get_icon(),
                icon_size: Math.round(18 * this.theme.scale),
                style: 'margin-right: 10px;',
            });
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

        const count = this.dialog._filtered.length;
        this.footer.set_text(`${count} match${count !== 1 ? 'es' : ''}`);
    }
}