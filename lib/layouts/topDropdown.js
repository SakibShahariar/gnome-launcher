// SPDX-License-Identifier: GPL-2.0-or-later

// Top-dropdown shade layout - archetype #8. Hangs from the top edge via
// position = 'top-flush', rounded only on bottom corners. Grid of
// results sits above the search bar (inverted order from the norm).

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';

const COLUMNS = 6;
const MAX_RESULTS = 18;

export class TopDropdownLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'top-flush';
        this.columns = COLUMNS;
    }

    buildUI() {
        const card = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${this.theme.surface}; border-radius: 0 0 24px 24px; ` +
                   'padding: 18px 24px 22px;',
        });
        card.set_width(620);

        this.gridBox = new St.BoxLayout({vertical: true, style: 'spacing: 8px; margin-bottom: 16px;'});
        card.add_child(this.gridBox);

        const searchRow = new St.BoxLayout({style: 'spacing: 10px;'});
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 15px;`,
            hint_text: 'Search applications',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        card.add_child(searchRow);

        return card;
    }

    renderResults() {
        this.gridBox.destroy_all_children();
        const total = this.dialog._filtered.length;
        this._windowStart = windowStart(this._windowStart, this.dialog._selectedIndex, total, MAX_RESULTS, COLUMNS);
        const start = this._windowStart;
        const apps = this.dialog._filtered.slice(start, start + MAX_RESULTS);
        for (let rowStart = 0; rowStart < apps.length; rowStart += COLUMNS) {
            const row = new St.BoxLayout({style: 'spacing: 6px;'});
            for (let i = rowStart; i < Math.min(rowStart + COLUMNS, apps.length); i++)
                row.add_child(this._buildTile(apps[i], start + i));
            this.gridBox.add_child(row);
        }
    }

    _buildTile(app, index) {
        const selected = index === this.dialog._selectedIndex;
        const tile = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style: selected
                ? `background-color: ${this.theme.primary}; border-radius: 10px; padding: 6px;`
                : 'border-radius: 10px; padding: 6px;',
        });
        tile.set_width(90);

        const icon = new St.Icon({gicon: app.get_icon(), icon_size: 22, x_align: Clutter.ActorAlign.CENTER});
        const label = new St.Label({
            text: app.get_name(),
            x_align: Clutter.ActorAlign.CENTER,
            style: `color: ${selected ? this.theme.on_primary : this.theme.on_surface_variant}; ` +
                   'font-size: 10px; text-align: center;',
        });
        label.set_width(82);
        label.clutter_text.set_line_wrap(false);
        label.clutter_text.set_ellipsize(3);

        tile.add_child(icon);
        tile.add_child(label);
        tile.connect('button-press-event', () => {
            this.dialog.launchIndex(index);
            return Clutter.EVENT_STOP;
        });
        return tile;
    }
}
