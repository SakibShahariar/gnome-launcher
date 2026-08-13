// SPDX-License-Identifier: GPL-2.0-or-later

// Sidebar categories layout - archetype #4. Vertical icon rail for
// mode-switching (apps/files/clipboard/power), main list fills the rest.
// Only "apps" mode is wired to real data - other icons are visual stubs,
// same caveat as the earlier GTK4 prototype had.

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';

// No fixed card height and no St.ScrollView here - two earlier fix
// attempts (a fixed height + resetScrollToTop) tried to make a *fixed*
// height reliably fit MAX_RESULTS rows, and got the exact pixel math
// wrong twice in a row (the selected row kept ending up just past the
// visible edge). Removing the fixed height instead of chasing that math
// a third time: the card now grows naturally to fit exactly however many
// rows render, the same approach every other layout already uses without
// this entire bug category ever showing up. windowStart (which items to
// show as you scroll) is still needed and kept - that logic was correct,
// only the fixed-height/ScrollView clipping mechanism was the problem.
const MAX_RESULTS = 8;
const MODES = [
    ['view-grid-symbolic', true],
    ['folder-symbolic', false],
    ['edit-paste-symbolic', false],
    ['system-shutdown-symbolic', false],
];

export class SidebarLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
    }

    buildUI() {
        const outer = new St.BoxLayout({
            style_class: 'launcher-card',
            style: `background-color: ${this.theme.surface}; border-radius: 20px; ` +
                   `border: 1px solid ${this.theme.outline_variant};`,
        });
        outer.set_width(520);

        const rail = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${this.theme.surface_container}; ` +
                   'border-radius: 20px 0 0 20px; padding: 12px 8px; spacing: 6px;',
        });
        for (const [iconName, active] of MODES) {
            const iconBox = new St.Bin({
                style: active
                    ? `background-color: ${this.theme.primary}; border-radius: 12px; padding: 8px;`
                    : 'border-radius: 12px; padding: 8px;',
            });
            iconBox.set_child(new St.Icon({
                icon_name: iconName,
                icon_size: 18,
                style: `color: ${active ? this.theme.on_primary : this.theme.on_surface_variant};`,
            }));
            rail.add_child(iconBox);
        }
        outer.add_child(rail);

        const main = new St.BoxLayout({vertical: true, x_expand: true});

        const searchRow = new St.BoxLayout({style: 'padding: 14px 18px;'});
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 15px;`,
            hint_text: 'Search apps',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        main.add_child(searchRow);

        this.resultsBox = new St.BoxLayout({vertical: true, style: 'padding: 0 10px 10px;'});
        main.add_child(this.resultsBox);
        outer.add_child(main);

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
                    ? `background-color: ${this.theme.primary}; border-radius: 14px; padding: 8px 12px;`
                    : 'border-radius: 14px; padding: 8px 12px;',
            });
            const icon = new St.Icon({gicon: app.get_icon(), icon_size: 18, style: 'margin-right: 10px;'});
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
