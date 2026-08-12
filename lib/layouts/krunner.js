// SPDX-License-Identifier: GPL-2.0-or-later

// Krunner-style dense top bar layout - archetype #12. Anchored to the
// top via position = 'top-flush', sharp square corners, flush dense rows
// with thin dividers instead of card padding.

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';

const MAX_RESULTS = 8;

export class KrunnerLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'top-flush';
    }

    buildUI() {
        const card = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${this.theme.surface}; ` +
                   `border: 1px solid ${this.theme.outline_variant}; border-top: none;`,
        });
        card.set_width(460);

        const searchRow = new St.BoxLayout({style: 'padding: 12px 16px;'});
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 15px;`,
            hint_text: 'Search',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        card.add_child(searchRow);

        this.resultsBox = new St.BoxLayout({vertical: true});
        card.add_child(this.resultsBox);

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
                style: `border-bottom: 1px solid ${this.theme.surface_container}; padding: 10px 16px;` +
                       (selected ? ` background-color: ${this.theme.primary};` : ''),
            });
            const icon = new St.Icon({gicon: app.get_icon(), icon_size: 16, style: 'margin-right: 10px;'});
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${selected ? this.theme.on_primary : this.theme.on_surface_variant}; font-size: 13px;`,
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
}
