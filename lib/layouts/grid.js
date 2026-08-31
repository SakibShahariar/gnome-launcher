// SPDX-License-Identifier: GPL-2.0-or-later

// Icon grid layout - archetype #1. St/Clutter port of layouts/grid.py.
// St has no direct FlowBox equivalent, so rows of tiles are built as
// nested BoxLayouts wrapping every COLUMNS icons - simple and reliable.

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';
import {withOpacity, withOpacityText, withSelectedOpacity} from '../theme.js';
import {makeEmptyLabel} from '../emptyState.js';

const COLUMNS = 4;
const MAX_RESULTS = 16;
const TILE_WIDTH = 96;

export class GridLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        // Read by launcherDialog.js's arrow-key handler so Down/Up jump a
        // full row instead of moving to the next item in list order.
        this.columns = COLUMNS;
        this._windowStart = 0;
    }

    buildUI() {
        const card = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 24px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 4px;`,
        });
        card.set_width(480);

        const searchRow = new St.BoxLayout({style: 'padding: 14px 18px;'});
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 16px;`,
            hint_text: 'Type to search',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        card.add_child(searchRow);

        this.gridBox = new St.BoxLayout({vertical: true, style: 'padding: 4px 14px 16px;'});
        card.add_child(this.gridBox);

        return card;
    }

    renderResults() {
        this.gridBox.destroy_all_children();

        const total = this.dialog._filtered.length;
        if (total === 0) {
            this.gridBox.add_child(makeEmptyLabel(this.theme));
            return;
        }
        this._windowStart = windowStart(this._windowStart, this.dialog._selectedIndex, total, MAX_RESULTS, COLUMNS);
        const start = this._windowStart;
        const apps = this.dialog._filtered.slice(start, start + MAX_RESULTS);
        for (let rowStart = 0; rowStart < apps.length; rowStart += COLUMNS) {
            const row = new St.BoxLayout({style: 'spacing: 10px; margin-bottom: 10px;'});
            for (let i = rowStart; i < Math.min(rowStart + COLUMNS, apps.length); i++)
                row.add_child(this._buildTile(apps[i], start + i));
            this.gridBox.add_child(row);
        }
    }

    _buildTile(app, index) {
        const selected = index === this.dialog._selectedIndex;
        // Fixed width on every tile is what keeps columns aligned across
        // rows - without it, a long app name in one row makes that whole
        // column wider than the others and the grid goes ragged.
        const tile = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style: (selected
                ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 16px; padding: 12px 4px;`
                : 'border-radius: 16px; padding: 12px 4px;'),
        });
        tile.set_width(TILE_WIDTH);

        const icon = new St.Icon({
            gicon: app.get_icon(),
            icon_size: Math.round(28 * this.theme.scale),
            x_align: Clutter.ActorAlign.CENTER,
        });
        const label = new St.Label({
            text: app.get_name(),
            x_align: Clutter.ActorAlign.CENTER,
            style: `color: ${selected ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant}; ` +
                   'font-size: 11px; text-align: center; font-weight: bold;',
        });
        // set_width() forces truncation at a fixed size regardless of text
        // length - without an explicit width, ellipsize has nothing to
        // truncate against and long names just overflow the tile instead.
        label.set_width(TILE_WIDTH - 12);
        label.clutter_text.set_line_wrap(false);
        label.clutter_text.set_ellipsize(3); // Pango.EllipsizeMode.END

        tile.add_child(icon);
        tile.add_child(label);
        tile.connect('button-press-event', () => {
            this.dialog.launchIndex(index);
            return Clutter.EVENT_STOP;
        });

        return tile;
    }
}