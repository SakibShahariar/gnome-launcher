// SPDX-License-Identifier: GPL-2.0-or-later

// Floating dock layout - archetype #6. Bottom-anchored search pill,
// results grow upward above it in a separate small panel.
//
// IMPORTANT: do NOT span the full monitor width with a transparent root.
// Blur My Shell (and similar) blur every actor in the modal dialog's
// allocation - a full-width invisible Bin produces a left-to-right blur
// strip across the bottom of the screen. Centering is done by setting
// fixedWidth and letting launcherDialog._applyPosition place dialogLayout.

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';
import {withOpacity, withOpacityText, withSelectedOpacity} from '../theme.js';
import {makeEmptyLabel} from '../emptyState.js';

const MAX_RESULTS = 5;
const DOCK_WIDTH = 340;

export class DockLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'bottom';
        // Used by launcherDialog._applyPosition for reliable horizontal
        // centering without a full-width transparent parent actor.
        this.fixedWidth = DOCK_WIDTH;
    }

    buildUI() {
        const root = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-card',
            style: 'spacing: 10px; background-color: transparent;',
        });
        root.set_width(DOCK_WIDTH);

        this.resultsBox = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 16px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 8px;`,
        });
        this.resultsBox.set_width(DOCK_WIDTH);
        root.add_child(this.resultsBox);

        const searchRow = new St.BoxLayout({
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 24px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 10px 18px;`,
        });
        searchRow.set_width(DOCK_WIDTH);
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 15px;`,
            hint_text: 'Type to search',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        root.add_child(searchRow);

        return root;
    }

    renderResults() {
        this.resultsBox.destroy_all_children();
        const total = this.dialog._filtered.length;
        if (total === 0) {
            this.resultsBox.show();
            this.resultsBox.add_child(makeEmptyLabel(this.theme));
            return;
        }
        this.resultsBox.show();
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
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 12px; padding: 8px 12px;`
                    : 'border-radius: 12px; padding: 8px 12px;',
            });
            const icon = new St.Icon({
                gicon: app.get_icon(),
                icon_size: Math.round(18 * this.theme.scale),
                style: `margin-right: 10px; color: ${iconColor};`,
            });
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${iconColor}; font-size: 13px; font-weight: bold;`,
            });
            label.set_width(280);
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
