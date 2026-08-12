// SPDX-License-Identifier: GPL-2.0-or-later

// Floating dock layout - archetype #6. Bottom-anchored search pill,
// results grow upward above it in a separate small panel. Uses
// `position = 'bottom'`, handled by launcherDialog.js's _applyPosition().

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';

const MAX_RESULTS = 5;

export class DockLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'bottom';
    }

    buildUI() {
        const outer = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            style: 'spacing: 10px;',
        });

        this.resultsBox = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${this.theme.surface}; border-radius: 16px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 8px;`,
        });
        this.resultsBox.set_width(300);
        outer.add_child(this.resultsBox);

        const searchRow = new St.BoxLayout({
            style: `background-color: ${this.theme.surface}; border-radius: 24px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 10px 18px;`,
        });
        searchRow.set_width(340);
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 15px;`,
            hint_text: 'Type to search',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        outer.add_child(searchRow);

        return outer;
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
                    ? `background-color: ${this.theme.primary}; border-radius: 12px; padding: 8px 12px;`
                    : 'border-radius: 12px; padding: 8px 12px;',
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
