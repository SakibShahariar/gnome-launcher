// SPDX-License-Identifier: GPL-2.0-or-later

// Fullscreen takeover layout - archetype #7. No floating card - fills
// the whole monitor via position = 'fullscreen'. Search pinned top-left,
// a big spacious icon grid fills the rest.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {windowStart} from './windowing.js';

const COLUMNS = 8;
const MAX_RESULTS = 48;

export class FullscreenLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'fullscreen';
        this.columns = COLUMNS;
    }

    buildUI() {
        const monitor = Main.layoutManager.primaryMonitor;
        const root = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${this.theme.surface}; padding: 48px 64px;`,
        });
        if (monitor) {
            root.set_width(monitor.width);
            root.set_height(monitor.height);
        }

        const searchRow = new St.BoxLayout({style: 'spacing: 10px;'});
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 18px;`,
            hint_text: 'Search apps',
            can_focus: true,
        });
        this.entry.set_width(360);
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        root.add_child(searchRow);

        this.gridBox = new St.BoxLayout({vertical: true, style: 'spacing: 20px; margin-top: 24px;'});
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
            const row = new St.BoxLayout({style: 'spacing: 12px;'});
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
                ? `background-color: ${this.theme.primary}; border-radius: 14px; padding: 10px;`
                : 'border-radius: 14px; padding: 10px;',
        });
        tile.set_width(110);

        const icon = new St.Icon({gicon: app.get_icon(), icon_size: Math.round(40 * this.theme.scale), x_align: Clutter.ActorAlign.CENTER});
        const label = new St.Label({
            text: app.get_name(),
            x_align: Clutter.ActorAlign.CENTER,
            style: `color: ${selected ? this.theme.on_primary : this.theme.on_surface_variant}; ` +
                   'font-size: 12px; text-align: center;',
        });
        label.set_width(100);
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
