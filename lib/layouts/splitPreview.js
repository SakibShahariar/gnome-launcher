// SPDX-License-Identifier: GPL-2.0-or-later

// Split preview panel layout - archetype #5. List on the left, a detail
// pane on the right showing the selected app's large icon, name, and
// description - updates live as selection moves.

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';
import {withOpacity, withOpacityText, withSelectedOpacity} from '../theme.js';

// No fixed card height and no St.ScrollView - same fragile-magic-number
// problem as sidebar.js had (fixed) applies here too even though not yet
// reported broken for this layout specifically. Natural sizing avoids it
// entirely. windowStart (which items to show as you scroll) is unaffected
// and still needed.
const MAX_RESULTS = 6;

export class SplitPreviewLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
    }

    buildUI() {
        const outer = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 20px; ` +
                   `border: 1px solid ${this.theme.outline_variant};`,
        });
        outer.set_width(560);

        const searchRow = new St.BoxLayout({style: 'padding: 14px 18px;'});
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 15px;`,
            hint_text: 'Search apps',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        outer.add_child(searchRow);

        const body = new St.BoxLayout({x_expand: true, y_expand: true});

        this.resultsBox = new St.BoxLayout({
            vertical: true,
            style: 'padding: 4px 4px 10px 10px;',
        });
        this.resultsBox.set_width(220);
        body.add_child(this.resultsBox);

        this.preview = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            style: 'spacing: 10px; padding: 20px;',
        });
        body.add_child(this.preview);

        outer.add_child(body);
        return outer;
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
                x_expand: true,
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 14px; padding: 8px 12px;`
                    : 'border-radius: 14px; padding: 8px 12px;',
            });
            const icon = new St.Icon({gicon: app.get_icon(), icon_size: Math.round(16 * this.theme.scale), style: 'margin-right: 10px;'});
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${selected ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant}; font-size: 13px; font-weight: bold;`,
            });
            label.set_width(150);
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

        this.preview.destroy_all_children();
        if (this.dialog._filtered.length === 0) {
            this.preview.add_child(new St.Label({
                text: 'No results — try a different query',
                x_align: Clutter.ActorAlign.CENTER,
                style: `color: ${this.theme.muted}; font-size: 12px;`,
            }));
            return;
        }
        const current = this.dialog._filtered[this.dialog._selectedIndex];
        if (current) {
            this.preview.add_child(new St.Icon({
                gicon: current.get_icon(),
                icon_size: Math.round(56 * this.theme.scale),
                x_align: Clutter.ActorAlign.CENTER,
            }));
            this.preview.add_child(new St.Label({
                text: current.get_name(),
                x_align: Clutter.ActorAlign.CENTER,
                style: `color: ${this.theme.on_surface}; font-size: 15px; font-weight: bold;`,
            }));
            const description = current.get_description() || 'No description available';
            const descLabel = new St.Label({
                text: description,
                x_align: Clutter.ActorAlign.CENTER,
                style: `color: ${this.theme.muted}; font-size: 12px; text-align: center;`,
            });
            descLabel.clutter_text.set_line_wrap(true);
            this.preview.add_child(descLabel);
        }
    }
}