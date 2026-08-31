// SPDX-License-Identifier: GPL-2.0-or-later

// Adaptive width layout - archetype #11. The card has no fixed width —
// it grows with the number of result tiles (one match = narrow panel,
// several = wider). Search keeps a minimum width so a single tile does
// not collapse the entry into an unusable strip.

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';
import {withOpacity, withOpacityText, withSelectedOpacity} from '../theme.js';
import {makeEmptyLabel} from '../emptyState.js';

const MAX_RESULTS = 6;
const TILE_WIDTH = 76;
const SEARCH_MIN_WIDTH = 220;

export class AdaptiveWidthLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        // Horizontal strip: left/right move by 1 (default columns = 1)
    }

    buildUI() {
        const card = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 20px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 4px;`,
        });
        // No set_width() on the card — width tracks content.

        const searchRow = new St.BoxLayout({style: 'padding: 12px 14px;'});
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 15px;`,
            hint_text: 'Search',
            can_focus: true,
        });
        // Floor so a 0–1 result panel still has a usable search field
        this.entry.set_width(SEARCH_MIN_WIDTH);
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        card.add_child(searchRow);

        this.tilesRow = new St.BoxLayout({
            style: 'spacing: 8px; padding: 4px 14px 16px;',
            x_align: Clutter.ActorAlign.CENTER,
        });
        card.add_child(this.tilesRow);

        return card;
    }

    renderResults() {
        this.tilesRow.destroy_all_children();
        const total = this.dialog._filtered.length;
        this._windowStart = windowStart(this._windowStart, this.dialog._selectedIndex, total, MAX_RESULTS);
        const start = this._windowStart;
        const apps = this.dialog._filtered.slice(start, start + MAX_RESULTS);

        if (apps.length === 0) {
            this.tilesRow.add_child(makeEmptyLabel(this.theme));
            this.entry.set_width(SEARCH_MIN_WIDTH);
            return;
        }

        // Widen search with the tile row so the header matches content width
        const contentWidth = Math.max(
            SEARCH_MIN_WIDTH,
            apps.length * TILE_WIDTH + Math.max(0, apps.length - 1) * 8);
        this.entry.set_width(contentWidth);

        apps.forEach((app, localIndex) => {
            const index = start + localIndex;
            const selected = index === this.dialog._selectedIndex;
            const iconColor = selected
                ? withOpacityText(this.theme.on_primary, this.theme.opacity)
                : this.theme.on_surface_variant;
            const tile = new St.BoxLayout({
                vertical: true,
                reactive: true,
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 10px 6px;`
                    : 'border-radius: 12px; padding: 10px 6px;',
            });
            tile.set_width(TILE_WIDTH);

            const icon = new St.Icon({
                gicon: app.get_icon(),
                icon_size: Math.round(24 * this.theme.scale),
                x_align: Clutter.ActorAlign.CENTER,
                style: `color: ${iconColor};`,
            });
            const label = new St.Label({
                text: app.get_name(),
                x_align: Clutter.ActorAlign.CENTER,
                style: `color: ${iconColor}; font-size: 10px; text-align: center; font-weight: bold;`,
            });
            label.set_width(70);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3);

            tile.add_child(icon);
            tile.add_child(label);
            tile.connect('button-press-event', () => {
                this.dialog.launchIndex(index);
                return Clutter.EVENT_STOP;
            });
            this.tilesRow.add_child(tile);
        });
    }
}
