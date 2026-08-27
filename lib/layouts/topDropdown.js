// SPDX-License-Identifier: GPL-2.0-or-later

// Top-dropdown shade layout - archetype #8. Hangs from the top edge,
// rounded only on bottom corners. Grid of results sits above the search
// bar (inverted order from the norm).
//
// STRUCTURAL NOTE: same fix as dock.js/krunner.js (see dock.js's comment
// for the full diagnostic story) - root spans the full monitor width
// explicitly and the visible card is centered via a plain St.Bin we
// fully own, instead of relying on Shell's ModalDialog to center a
// narrow card within its own (proven unreliable) internal width.

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {windowStart} from './windowing.js';
import {withOpacity} from '../theme.js';

const COLUMNS = 6;
const MAX_RESULTS = 18;

export class TopDropdownLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
        this.position = 'top-flush-fullwidth';
        this.columns = COLUMNS;
    }

    buildUI() {
        const monitor = Main.layoutManager.primaryMonitor;

        const root = new St.Bin({x_align: Clutter.ActorAlign.CENTER});
        if (monitor)
            root.set_width(monitor.width);

        const card = new St.BoxLayout({
            vertical: true,
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 0 0 24px 24px; ` +
                   'padding: 18px 24px 22px;',
        });
        card.set_width(620);

        this.gridBox = new St.BoxLayout({vertical: true, style: 'spacing: 8px; margin-bottom: 16px;'});
        card.add_child(this.gridBox);

        const searchRow = new St.BoxLayout({style: 'spacing: 10px;'});
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

        root.set_child(card);
        this.rootActor = root;
        return root;
    }

    renderResults() {
        this.gridBox.destroy_all_children();
        const total = this.dialog._filtered.length;
        this._windowStart = windowStart(this._windowStart, this.dialog._selectedIndex, total, MAX_RESULTS, COLUMNS);
        const start = this._windowStart;
        const apps = this.dialog._filtered.slice(start, start + MAX_RESULTS);
        for (let rowStart = 0; rowStart < apps.length; rowStart += COLUMNS) {
            const row = new St.BoxLayout({style: 'spacing: 6px;'});
            for (let i = rowStart; i < Math.min(rowStart + COLUMNS, apps.length); i++)
                row.add_child(this._buildTile(apps[i], start + i));
            this.gridBox.add_child(row);
        }
    }

    _buildTile(app, index) {
        const selected = index === this.dialog._selectedIndex;
        const tile = new St.BoxLayout({
            vertical: true,
            reactive: true,
            style: selected
                ? `background-color: ${this.theme.primary}; border-radius: 10px; padding: 6px;`
                : 'border-radius: 10px; padding: 6px;',
        });
        tile.set_width(90);

        const icon = new St.Icon({gicon: app.get_icon(), icon_size: Math.round(22 * this.theme.scale), x_align: Clutter.ActorAlign.CENTER});
        const label = new St.Label({
            text: app.get_name(),
            x_align: Clutter.ActorAlign.CENTER,
            style: `color: ${selected ? this.theme.on_primary : this.theme.on_surface_variant}; ` +
                   'font-size: 10px; text-align: center;',
        });
        label.set_width(82);
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