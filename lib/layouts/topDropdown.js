// SPDX-License-Identifier: GPL-2.0-or-later

// Top-dropdown shade layout - archetype #8. A full-width panel that
// hangs from the top edge like a notification shade: flush to the top,
// rounded only on the bottom corners, search at the top, icon grid
// below. Full width is intentional — Blur My Shell blurring the top
// band is correct for a shade (unlike dock/krunner, which are narrow
// centered cards and must not use a transparent full-width root).

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {windowStart} from './windowing.js';
import {withOpacity, withOpacityText, withSelectedOpacity} from '../theme.js';
import {makeEmptyLabel} from '../emptyState.js';

const TILE_WIDTH = 96;
const TILE_GAP = 8;
const H_PADDING = 28;
const MAX_ROWS = 3;

export class TopDropdownLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'top-flush';
        this.columns = this._computeColumns();
        // fixedWidth = monitor width so horizontal centering is a no-op
        // and dialogLayout matches the shade width (no side gaps).
        const monitor = Main.layoutManager.primaryMonitor;
        this.fixedWidth = monitor ? monitor.width : 1200;
    }

    _computeColumns() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return 8;
        const usable = Math.max(monitor.width - H_PADDING * 2, TILE_WIDTH);
        const cols = Math.floor((usable + TILE_GAP) / (TILE_WIDTH + TILE_GAP));
        return Math.max(6, Math.min(cols, 18));
    }

    buildUI() {
        const monitor = Main.layoutManager.primaryMonitor;
        this.columns = this._computeColumns();
        const width = monitor ? monitor.width : 1200;
        this.fixedWidth = width;

        const card = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; ` +
                   'border-radius: 0 0 28px 28px; ' +
                   `border: 1px solid ${this.theme.outline_variant}; border-top: none; ` +
                   `padding: 16px ${H_PADDING}px 22px;`,
        });
        card.set_width(width);

        // Search at the top — typical for a dropdown shade
        const searchRow = new St.BoxLayout({
            style: `background-color: ${withOpacity(this.theme.surface_container, this.theme.opacity)}; ` +
                   'border-radius: 14px; padding: 10px 16px; margin-bottom: 14px;',
            x_expand: true,
        });
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 15px;`,
            hint_text: 'Search applications',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        card.add_child(searchRow);

        this.gridBox = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 10px;',
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        card.add_child(this.gridBox);

        return card;
    }

    renderResults() {
        this.gridBox.destroy_all_children();
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
                ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 8px;`
                : 'border-radius: 12px; padding: 8px;',
        });
        tile.set_width(TILE_WIDTH);

        const icon = new St.Icon({
            gicon: app.get_icon(),
            icon_size: Math.round(28 * this.theme.scale),
            x_align: Clutter.ActorAlign.CENTER,
            style: `color: ${iconColor};`,
        });
        const label = new St.Label({
            text: app.get_name(),
            x_align: Clutter.ActorAlign.CENTER,
            style: `color: ${iconColor}; font-size: 11px; text-align: center; font-weight: bold;`,
        });
        label.set_width(TILE_WIDTH - 8);
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
