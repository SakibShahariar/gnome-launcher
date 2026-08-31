// SPDX-License-Identifier: GPL-2.0-or-later

// Full-edge side panel layout - archetype #10. A tall strip on the left
// edge of the screen: search on top, icon grid below, rounded only on the
// right side so it reads as a desktop panel rather than a floating card.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {windowStart, resetScrollToTop} from './windowing.js';
import {withOpacity, withOpacityText, withSelectedOpacity} from '../theme.js';
import {makeEmptyLabel} from '../emptyState.js';

const COLUMNS = 3;
const MAX_RESULTS = 30;
const PANEL_WIDTH = 300;
const EDGE_MARGIN = 0; // flush to left; vertical margin handled by height

export class FullEdgeLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'left-edge';
        this.columns = COLUMNS;
        this.fixedWidth = PANEL_WIDTH;
    }

    buildUI() {
        const monitor = Main.layoutManager.primaryMonitor;
        // Right side only rounded — left side flush against the screen edge
        const root = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; ` +
                   'border-radius: 0 20px 20px 0; ' +
                   `border: 1px solid ${this.theme.outline_variant}; border-left: none; ` +
                   'padding: 20px 16px;',
        });
        root.set_width(PANEL_WIDTH);
        if (monitor)
            root.set_height(Math.max(monitor.height - 48, 400));

        const searchRow = new St.BoxLayout({
            style: `background-color: ${withOpacity(this.theme.surface_container, this.theme.opacity)}; ` +
                   'border-radius: 12px; padding: 8px 12px; margin-bottom: 4px;',
            x_expand: true,
        });
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

        this.gridBox = new St.BoxLayout({
            vertical: true,
            style: 'spacing: 10px; margin-top: 14px;',
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });
        this.scrollView = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
            y_expand: true,
            x_expand: true,
        });
        this.scrollView.set_child(this.gridBox);
        root.add_child(this.scrollView);

        return root;
    }

    renderResults() {
        this.gridBox.destroy_all_children();
        const total = this.dialog._filtered.length;
        if (total === 0) {
            this.gridBox.add_child(makeEmptyLabel(this.theme));
            return;
        }
        this._windowStart = windowStart(
            this._windowStart, this.dialog._selectedIndex, total, MAX_RESULTS, COLUMNS);
        const start = this._windowStart;
        const apps = this.dialog._filtered.slice(start, start + MAX_RESULTS);

        for (let rowStart = 0; rowStart < apps.length; rowStart += COLUMNS) {
            const row = new St.BoxLayout({
                style: 'spacing: 8px;',
                x_align: Clutter.ActorAlign.CENTER,
            });
            for (let i = rowStart; i < Math.min(rowStart + COLUMNS, apps.length); i++)
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
                ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 10px; padding: 6px;`
                : 'border-radius: 10px; padding: 6px;',
        });
        tile.set_width(80);

        const icon = new St.Icon({
            gicon: app.get_icon(),
            icon_size: Math.round(22 * this.theme.scale),
            x_align: Clutter.ActorAlign.CENTER,
            style: `color: ${iconColor};`,
        });
        const label = new St.Label({
            text: app.get_name(),
            x_align: Clutter.ActorAlign.CENTER,
            style: `color: ${iconColor}; font-size: 10px; text-align: center; font-weight: bold;`,
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
