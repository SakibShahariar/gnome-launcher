// SPDX-License-Identifier: GPL-2.0-or-later

// Floating dock layout - archetype #6. Bottom-anchored search pill,
// results grow upward above it in a separate small panel.
//
// STRUCTURAL NOTE: this layout previously relied on Shell's own
// ModalDialog centering a narrow (340px) card within dialogLayout's
// width via x_align: CENTER - proven unreliable through extensive
// diagnostic logging (dialogLayout/contentLayout's actual width and
// position fluctuated inconsistently between renders, sometimes stale
// from an earlier pass). fullscreen.js and full-edge.js never showed
// this bug, and the one thing they share is spanning the FULL monitor
// width rather than asking Shell to center something narrower. This
// version copies that pattern: the root actor always spans the full
// monitor width explicitly (deterministic, set by us), and the visible
// pill is centered via a plain St.Bin - a widget we create and fully
// own, not anything ModalDialog manages internally.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {windowStart} from './windowing.js';
import {withOpacity} from '../theme.js';

const MAX_RESULTS = 5;

export class DockLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        // Tells launcherDialog.js's _applyPosition() to skip the
        // centering-within-ambiguous-parent-width calculation entirely -
        // x is just monitor.x, since this layout spans the full width
        // itself and does its own internal centering.
        this.position = 'bottom-fullwidth';
    }

    buildUI() {
        const monitor = Main.layoutManager.primaryMonitor;

        const root = new St.Bin({x_align: Clutter.ActorAlign.CENTER});
        if (monitor)
            root.set_width(monitor.width);

        const inner = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            style: 'spacing: 10px;',
        });

        this.resultsBox = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 16px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 8px;`,
        });
        this.resultsBox.set_width(300);
        inner.add_child(this.resultsBox);

        const searchRow = new St.BoxLayout({
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 24px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 10px 18px;`,
        });
        searchRow.set_width(340);
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 15px; width: 260px;`,
            hint_text: 'Type to search',
            can_focus: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        inner.add_child(searchRow);

        root.set_child(inner);
        this.rootActor = root;
        return root;
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
                    ? `background-color: ${this.theme.primary}; border-radius: 12px; padding: 8px 12px;`
                    : 'border-radius: 12px; padding: 8px 12px;',
            });
            const icon = new St.Icon({gicon: app.get_icon(), icon_size: Math.round(16 * this.theme.scale), style: 'margin-right: 10px;'});
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${selected ? this.theme.on_primary : this.theme.on_surface_variant}; font-size: 13px;`,
            });
            // Without an explicit width, a long name's natural size could
            // exceed resultsBox's fixed 300px - every other layout
            // constrains its labels this way already, this one was
            // missing it.
            label.set_width(200);
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