// SPDX-License-Identifier: GPL-2.0-or-later

// Hero banner with floating mode icons - archetype #14. A gradient-style
// banner spans the top with the search field embedded in it, plus
// circular icon buttons (apps/run/files/window) floating on it. Only
// "Apps" mode wired to data - other icons are visual stubs.

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';

const MAX_RESULTS = 6;
const MODES = [['view-grid-symbolic', true], ['utilities-terminal-symbolic', false],
    ['folder-symbolic', false], ['view-list-symbolic', false]];

export class HeroBannerLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
    }

    buildUI() {
        const card = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-card',
            style: `background-color: ${this.theme.surface}; border-radius: 20px; ` +
                   `border: 1px solid ${this.theme.outline_variant};`,
        });
        card.set_width(460);

        const banner = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${this.theme.primary_container}; ` +
                   'border-radius: 20px 20px 0 0; padding: 14px 16px; spacing: 12px;',
        });

        const searchRow = new St.BoxLayout({
            style: `background-color: alpha(${this.theme.on_primary_container}, 0.12); ` +
                   'border-radius: 20px; padding: 8px 14px;',
        });
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_primary_container}; font-size: 14px;`,
            hint_text: 'Search',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        banner.add_child(searchRow);

        const iconsRow = new St.BoxLayout({style: 'spacing: 8px;'});
        for (const [iconName, active] of MODES) {
            const circle = new St.Bin({
                style: active
                    ? `background-color: ${this.theme.primary}; border-radius: 999px; padding: 8px;`
                    : `background-color: alpha(${this.theme.on_primary_container}, 0.15); ` +
                      'border-radius: 999px; padding: 8px;',
            });
            circle.set_child(new St.Icon({
                icon_name: iconName,
                icon_size: 14,
                style: `color: ${active ? this.theme.on_primary : this.theme.on_primary_container};`,
            }));
            iconsRow.add_child(circle);
        }
        banner.add_child(iconsRow);
        card.add_child(banner);

        this.resultsBox = new St.BoxLayout({vertical: true, style: 'padding: 6px 8px 10px;'});
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
                style: selected
                    ? `background-color: ${this.theme.primary}; border-radius: 12px; padding: 8px 10px;`
                    : 'border-radius: 12px; padding: 8px 10px;',
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
