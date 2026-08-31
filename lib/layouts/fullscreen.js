// SPDX-License-Identifier: GPL-2.0-or-later

// Fullscreen takeover layout - archetype #7. No floating card - fills
// the whole monitor via position = 'fullscreen'. Search pinned top-left,
// a spacious icon grid fills and centers in the remaining space.
// Column count is derived from monitor width so wide screens use the
// full horizontal space instead of leaving a large empty right margin.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {windowStart, resetScrollToTop} from './windowing.js';
import {withOpacity, withOpacityText, withSelectedOpacity} from '../theme.js';
import {makeEmptyLabel} from '../emptyState.js';

const TILE_WIDTH = 110;
const TILE_GAP = 12;
const H_PADDING = 64;
const MAX_ROWS = 6;

export class FullscreenLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'fullscreen';
        this.columns = this._computeColumns();
    }

    _computeColumns() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return 8;
        const usable = Math.max(monitor.width - H_PADDING * 2, TILE_WIDTH);
        const cols = Math.floor((usable + TILE_GAP) / (TILE_WIDTH + TILE_GAP));
        return Math.max(4, Math.min(cols, 16));
    }

    buildUI() {
        const monitor = Main.layoutManager.primaryMonitor;
        this.columns = this._computeColumns();

        const root = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; ` +
                   `padding: 48px ${H_PADDING}px;`,
        });
        if (monitor) {
            root.set_width(monitor.width);
            root.set_height(monitor.height);
        }

        const searchRow = new St.BoxLayout({
            style: 'spacing: 10px;',
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 18px;`,
            hint_text: 'Search apps',
            can_focus: true,
        });
        this.entry.set_width(420);
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        root.add_child(searchRow);

        // Center the grid horizontally within the fullscreen area
        this.gridBox = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 20px;',
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        this.scrollView = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
            y_expand: true,
            x_expand: true,
            style: 'margin-top: 24px;',
        });
        this.scrollView.set_child(this.gridBox);
        root.add_child(this.scrollView);

        return root;
    }

    renderResults() {
        this.gridBox.destroy_all_children();
        // Recompute in case monitor geometry changed since construct
        this.columns = this._computeColumns();
        const maxResults = this.columns * MAX_ROWS;

        const total = this.dialog._filtered.length;
        if (total === 0) {
            this.gridBox.add_child(makeEmptyLabel(this.theme));
            return;
        }
        this._windowStart = windowStart(
            this._windowStart, this.dialog._selectedIndex, total, maxResults, this.columns);
        const start = this._windowStart;
        const apps = this.dialog._filtered.slice(start, start + maxResults);

        for (let rowStart = 0; rowStart < apps.length; rowStart += this.columns) {
            const row = new St.BoxLayout({
                style: `spacing: ${TILE_GAP}px;`,
                x_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
            });
            for (let i = rowStart; i < Math.min(rowStart + this.columns, apps.length); i++)
                row.add_child(this._buildTile(apps[i], start + i));
            this.gridBox.add_child(row);
        }
        resetScrollToTop(this.scrollView);
    }

    _buildTile(app, index) {
        const selected = index === this.dialog._selectedIndex;
        const iconColor = selected
            ? withOpacityText(this.theme.on_primary, this.theme.opacity)
            : this.theme.on_surface_variant;
        const tile = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style: selected
                ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 14px; padding: 10px;`
                : 'border-radius: 14px; padding: 10px;',
        });
        tile.set_width(TILE_WIDTH);

        const icon = new St.Icon({
            gicon: app.get_icon(),
            icon_size: Math.round(40 * this.theme.scale),
            x_align: Clutter.ActorAlign.CENTER,
            style: `color: ${iconColor};`,
        });
        const label = new St.Label({
            text: app.get_name(),
            x_align: Clutter.ActorAlign.CENTER,
            style: `color: ${iconColor}; font-size: 12px; text-align: center; font-weight: bold;`,
        });
        label.set_width(TILE_WIDTH - 10);
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
