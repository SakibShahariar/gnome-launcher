// SPDX-License-Identifier: GPL-2.0-or-later

// Notch-style layout. Hangs flush against the top-center of the screen
// like a hardware camera notch - narrow and centered, unlike
// top-dropdown which spans the full width. Rounded only on the bottom
// corners, matching the mockup.
//
// Uses the same full-width-root + St.Bin centering pattern proven by
// dock.js/krunner.js (see dock.js's comment for the full diagnostic
// story) rather than relying on Shell's own centering, which was shown
// to be unreliable.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {windowStart} from './windowing.js';
import {withOpacity} from '../theme.js';

const MAX_RESULTS = 6;
const CARD_WIDTH = 380;

export class NotchLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'top-flush-fullwidth';
    }

    buildUI() {
        const monitor = Main.layoutManager.primaryMonitor;

        const root = new St.Bin({x_align: Clutter.ActorAlign.CENTER});
        if (monitor)
            root.set_width(monitor.width);

        const card = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; ` +
                   `border: 1px solid ${this.theme.outline_variant}; border-top: none; ` +
                   'border-radius: 0 0 20px 20px;',
        });
        card.set_width(CARD_WIDTH);

        const searchRow = new St.BoxLayout({style: 'padding: 12px 18px; spacing: 10px;'});
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; ` +
                   'font-size: 14px; width: 300px;',
            hint_text: 'Search',
            can_focus: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        card.add_child(searchRow);

        const divider = new St.Widget({
            style: `background-color: ${this.theme.outline_variant};`,
            height: 1,
        });
        card.add_child(divider);

        this.resultsBox = new St.BoxLayout({vertical: true, style: 'padding: 6px;'});
        this.resultsBox.set_width(CARD_WIDTH);
        card.add_child(this.resultsBox);

        root.set_child(card);
        this.rootActor = root;
        return root;
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
                style: selected
                    ? `background-color: ${this.theme.primary}; border-radius: 12px; padding: 8px 12px;`
                    : 'border-radius: 12px; padding: 8px 12px;',
            });
            row.set_width(CARD_WIDTH - 12);

            const icon = new St.Icon({gicon: app.get_icon(), icon_size: Math.round(16 * this.theme.scale), style: 'margin-right: 10px;'});
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${selected ? this.theme.on_primary : this.theme.on_surface_variant}; font-size: 13px;`,
            });
            label.set_width(CARD_WIDTH - 60);
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