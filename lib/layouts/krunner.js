// SPDX-License-Identifier: GPL-2.0-or-later

// Krunner-style dense top bar - archetype #12. Flush to the top edge,
// square top corners, search with a hard divider, compact result rows
// with hairline separators. Centered narrow panel (not full-width) so
// Blur My Shell does not paint a strip across the whole screen.

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';
import {withOpacity, withOpacityText, withSelectedOpacity} from '../theme.js';
import {makeEmptyLabel} from '../emptyState.js';

const MAX_RESULTS = 8;
const CARD_WIDTH = 520;

export class KrunnerLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'top-flush';
        this.fixedWidth = CARD_WIDTH;
    }

    buildUI() {
        const card = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; ` +
                   `border: 1px solid ${this.theme.outline_variant}; border-top: none; ` +
                   'border-radius: 0 0 12px 12px;',
        });
        card.set_width(CARD_WIDTH);

        // Search + hard rule underneath (classic KRunner chrome)
        const searchRow = new St.BoxLayout({
            style: `padding: 14px 18px; border-bottom: 1px solid ${this.theme.outline_variant};`,
            x_expand: true,
        });
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 16px;`,
            hint_text: 'Type to search…',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        card.add_child(searchRow);

        this.resultsBox = new St.BoxLayout({vertical: true});
        this.resultsBox.set_width(CARD_WIDTH);
        card.add_child(this.resultsBox);

        return card;
    }

    renderResults() {
        this.resultsBox.destroy_all_children();
        const total = this.dialog._filtered.length;
        if (total === 0) {
            this.resultsBox.add_child(makeEmptyLabel(this.theme));
            return;
        }

        this._windowStart = windowStart(this._windowStart, this.dialog._selectedIndex, total, MAX_RESULTS);
        const start = this._windowStart;
        const apps = this.dialog._filtered.slice(start, start + MAX_RESULTS);

        apps.forEach((app, localIndex) => {
            const index = start + localIndex;
            const selected = index === this.dialog._selectedIndex;
            const isLast = localIndex === apps.length - 1;
            const iconColor = selected
                ? withOpacityText(this.theme.on_primary, this.theme.opacity)
                : this.theme.on_surface_variant;

            let rowStyle = 'padding: 8px 18px;';
            if (!isLast)
                rowStyle += ` border-bottom: 1px solid ${this.theme.surface_container};`;
            if (selected)
                rowStyle += ` background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)};`;

            const row = new St.BoxLayout({
                reactive: true,
                x_expand: true,
                style: rowStyle,
            });
            row.set_width(CARD_WIDTH);

            const icon = new St.Icon({
                gicon: app.get_icon(),
                icon_size: Math.round(18 * this.theme.scale),
                style: `margin-right: 12px; color: ${iconColor};`,
            });
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${iconColor}; font-size: 13px;`,
            });
            label.set_width(CARD_WIDTH - 60);
            label.clutter_text.set_line_wrap(false);
            label.clutter_text.set_ellipsize(3);

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
