// SPDX-License-Identifier: GPL-2.0-or-later

// Corner-anchored panel layout - archetype #9. Same floating-card idea
// as the centered layouts, but anchored to the top-left corner via
// position = 'top-left' instead - smaller footprint, feels like a widget
// rather than a modal takeover.

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';
import {withOpacity, withOpacityText, withSelectedOpacity} from '../theme.js';

const MAX_RESULTS = 6;

export class CornerLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'top-left';
        this.fixedWidth = 320;
    }

    buildUI() {
        const card = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 18px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 4px;`,
        });
        card.set_width(320);

        const searchRow = new St.BoxLayout({style: 'padding: 12px 14px;'});
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
        card.add_child(searchRow);

        this.resultsBox = new St.BoxLayout({vertical: true, style: 'padding: 0 6px 6px;'});
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
            const iconColor = selected
                ? withOpacityText(this.theme.on_primary, this.theme.opacity)
                : this.theme.on_surface_variant;
            const row = new St.BoxLayout({
                reactive: true,
                x_expand: true,
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 7px 10px;`
                    : 'border-radius: 12px; padding: 7px 10px;',
            });
            const icon = new St.Icon({
                gicon: app.get_icon(),
                icon_size: Math.round(16 * this.theme.scale),
                style: `margin-right: 8px; color: ${iconColor};`,
            });
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${iconColor}; font-size: 12px; font-weight: bold;`,
            });
            label.set_width(260);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3); // Pango.EllipsizeMode.END
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