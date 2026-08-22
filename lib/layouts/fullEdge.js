// SPDX-License-Identifier: GPL-2.0-or-later

// Full-edge side panel layout - archetype #10. Not a floating popup - a
// strip anchored to the left edge via position = 'left-edge', with a
// fixed height set to feel like part of the desktop's own structure.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {windowStart} from './windowing.js';

const COLUMNS = 3;
const MAX_RESULTS = 30;

export class FullEdgeLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'left-edge';
        this.columns = COLUMNS;
    }

    buildUI() {
        const monitor = Main.layoutManager.primaryMonitor;
        const root = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${this.theme.surface}; border-radius: 20px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 20px 16px;`,
        });
        root.set_width(300);
        if (monitor)
            root.set_height(monitor.height - 64);

        const searchRow = new St.BoxLayout({style: 'spacing: 8px;'});
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
        root.add_child(searchRow);

        this.gridBox = new St.BoxLayout({vertical: true, style: 'spacing: 10px; margin-top: 14px;'});
        this.scrollView = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
            y_expand: true,
        });
        this.scrollView.set_child(this.gridBox);
        root.add_child(this.scrollView);

        return root;
    }

    renderResults() {
        this.gridBox.destroy_all_children();
        const total = this.dialog._filtered.length;
        this._windowStart = windowStart(this._windowStart, this.dialog._selectedIndex, total, MAX_RESULTS, COLUMNS);
        const start = this._windowStart;
        const apps = this.dialog._filtered.slice(start, start + MAX_RESULTS);
        for (let rowStart = 0; rowStart < apps.length; rowStart += COLUMNS) {
            const row = new St.BoxLayout({style: 'spacing: 8px;'});
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
        tile.set_width(80);

        const icon = new St.Icon({gicon: app.get_icon(), icon_size: Math.round(22 * this.theme.scale), x_align: Clutter.ActorAlign.CENTER});
        const label = new St.Label({
            text: app.get_name(),
            x_align: Clutter.ActorAlign.CENTER,
            style: `color: ${selected ? this.theme.on_primary : this.theme.on_surface_variant}; ` +
                   'font-size: 10px; text-align: center;',
        });
        label.set_width(72);
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
