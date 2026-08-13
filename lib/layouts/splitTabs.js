// SPDX-License-Identifier: GPL-2.0-or-later

// Split panel with mode-tab pills - archetype #13. Left column: search +
// a decorative accent panel + pill-shaped mode tabs (Apps/Run/Files/
// Window). Right column: result list. Only "Apps" mode wired to data.

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';

// No fixed card height and no St.ScrollView - same fragile-magic-number
// problem as sidebar.js had applies here too. Natural sizing avoids it
// entirely; the accent panel's y_expand just stretches to match whatever
// height the results list ends up needing.
const MAX_RESULTS = 7;
const MODES = ['APPS', 'RUN', 'FILES', 'WINDOW'];

export class SplitTabsLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
    }

    buildUI() {
        const outer = new St.BoxLayout({
            style_class: 'launcher-card',
            style: `background-color: ${this.theme.surface}; border-radius: 20px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 14px; spacing: 14px;`,
        });
        outer.set_width(640);

        const left = new St.BoxLayout({vertical: true, style: 'spacing: 10px;'});
        left.set_width(260);

        const searchRow = new St.BoxLayout({});
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 14px;`,
            hint_text: 'Search',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        left.add_child(searchRow);

        const accent = new St.Bin({
            style: `background-color: ${this.theme.primary_container}; border-radius: 16px;`,
            y_expand: true,
            x_expand: true,
        });
        left.add_child(accent);

        const tabs = new St.BoxLayout({style: 'spacing: 6px;'});
        MODES.forEach((mode, i) => {
            const tab = new St.Bin({
                x_expand: true,
                style: i === 0
                    ? `background-color: ${this.theme.primary}; border-radius: 10px; padding: 8px 4px;`
                    : 'border-radius: 10px; padding: 8px 4px;',
            });
            tab.set_child(new St.Label({
                text: mode,
                x_align: Clutter.ActorAlign.CENTER,
                style: `color: ${i === 0 ? this.theme.on_primary : this.theme.on_surface_variant}; font-size: 10px;`,
            }));
            tabs.add_child(tab);
        });
        left.add_child(tabs);
        outer.add_child(left);

        this.resultsBox = new St.BoxLayout({vertical: true, x_expand: true, style: 'spacing: 2px;'});
        outer.add_child(this.resultsBox);

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
