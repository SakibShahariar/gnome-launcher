// SPDX-License-Identifier: GPL-2.0-or-later

// Krunner-style dense top bar layout - archetype #12. Anchored to the
// top, sharp square corners, flush dense rows with thin dividers instead
// of card padding.
//
// STRUCTURAL NOTE: same fix as dock.js (see that file's comment for the
// full diagnostic story) - root spans the full monitor width explicitly
// and the visible card is centered via a plain St.Bin we fully own,
// instead of relying on Shell's ModalDialog to center a narrow card
// within its own (proven unreliable) internal width.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {windowStart} from './windowing.js';
import {withOpacity} from '../theme.js';

const MAX_RESULTS = 8;

export class KrunnerLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        // Tells launcherDialog.js's _applyPosition() to skip centering-
        // within-ambiguous-parent-width - x is just monitor.x, since this
        // layout spans the full width itself and centers internally.
        this.position = 'top-flush-fullwidth';
    }

    buildUI() {
        const monitor = Main.layoutManager.primaryMonitor;

        const root = new St.Bin({x_align: Clutter.ActorAlign.CENTER});
        if (monitor)
            root.set_width(monitor.width);

        const card = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; ` +
                   `border: 1px solid ${this.theme.outline_variant}; border-top: none;`,
        });
        card.set_width(460);

        const searchRow = new St.BoxLayout({style: 'padding: 12px 16px;', x_expand: true});
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 15px;`,
            hint_text: 'Search',
            can_focus: true,
            x_expand: true,
        });
        this.entry.set_width(400);
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        card.add_child(searchRow);

        this.resultsBox = new St.BoxLayout({vertical: true});
        this.resultsBox.set_width(460);
        card.add_child(this.resultsBox);

        root.set_child(card);
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
                style: `border-bottom: 1px solid ${this.theme.surface_container}; padding: 10px 16px;` +
                       (selected ? ` background-color: ${this.theme.primary};` : ''),
            });
            row.set_width(460);
            const icon = new St.Icon({gicon: app.get_icon(), icon_size: Math.round(16 * this.theme.scale), style: 'margin-right: 10px;'});
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${selected ? this.theme.on_primary : this.theme.on_surface_variant}; font-size: 13px;`,
            });
            label.set_width(400);
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