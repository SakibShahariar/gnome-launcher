// SPDX-License-Identifier: GPL-2.0-or-later

// Numbered hotkey layout - archetype #3. Same structure as ListLayout,
// but each row shows a number (1-9) and onDigitKey() lets the dialog's
// key handler launch a row directly without needing arrow keys first.

import St from 'gi://St';
import Clutter from 'gi://Clutter';

import {windowStart} from './windowing.js';
import {withOpacity, withOpacityText, withSelectedOpacity} from '../theme.js';

const MAX_RESULTS = 9;

export class HotkeyLayout {
    constructor(dialog, theme) {
        this.dialog = dialog;
        this.theme = theme;
        this._windowStart = 0;
    }

    buildUI() {
        const card = new St.BoxLayout({
            vertical: true,
            style_class: 'launcher-card',
            style: `background-color: ${withOpacity(this.theme.surface, this.theme.opacity)}; border-radius: 20px; ` +
                   `border: 1px solid ${this.theme.outline_variant}; padding: 4px;`,
        });
        card.set_width(460);

        const searchRow = new St.BoxLayout({style: 'padding: 12px 14px;'});
        this.entry = new St.Entry({
            style_class: 'launcher-search',
            style: `background: none; border: none; color: ${this.theme.on_surface}; font-size: 16px;`,
            hint_text: 'run:',
            can_focus: true,
            x_expand: true,
        });
        this.entry.clutter_text.connect('text-changed', () => {
            this.dialog.onQueryChanged(this.entry.get_text());
        });
        searchRow.add_child(this.entry);
        card.add_child(searchRow);

        this.resultsBox = new St.BoxLayout({vertical: true, style: 'padding: 0 6px 6px;'});
        card.add_child(this.resultsBox);

        this.footer = new St.Label({
            text: 'press 1-9 or enter',
            style: `color: ${this.theme.muted}; font-size: 11px; padding: 4px 16px 8px;`,
        });
        card.add_child(this.footer);

        return card;
    }

    renderResults() {
        this.resultsBox.destroy_all_children();

        const total = this.dialog._filtered.length;
        // Stored so onDigitKey below can map "pressed 3" (a position
        // within the visible window) back to the correct absolute index -
        // without this, digit keys would launch the wrong app whenever
        // the window has scrolled away from the start of the list.
        this._windowStart = windowStart(this._windowStart, this.dialog._selectedIndex, total, MAX_RESULTS);
        const apps = this.dialog._filtered.slice(this._windowStart, this._windowStart + MAX_RESULTS);
        apps.forEach((app, localIndex) => {
            const index = this._windowStart + localIndex;
            const selected = index === this.dialog._selectedIndex;
            const row = new St.BoxLayout({
                reactive: true,
                x_expand: true,
                style: selected
                    ? `background-color: ${withSelectedOpacity(this.theme.primary, this.theme.opacity)}; border-radius: 14px; padding: 8px 12px;`
                    : 'border-radius: 14px; padding: 8px 12px;',
            });

            const number = new St.Label({
                text: String(localIndex + 1),
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${selected ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant}; font-size: 12px; font-weight: bold;`,
            });
            number.set_width(18);
            const icon = new St.Icon({
                gicon: app.get_icon(),
                icon_size: Math.round(18 * this.theme.scale),
                style: 'margin: 0 10px;',
            });
            const label = new St.Label({
                text: app.get_name(),
                y_align: Clutter.ActorAlign.CENTER,
                style: `color: ${selected ? withOpacityText(this.theme.on_primary, this.theme.opacity) : this.theme.on_surface_variant}; font-size: 13px; font-weight: bold;`,
            });

            row.add_child(number);
            row.add_child(icon);
            row.add_child(label);
            row.connect('button-press-event', () => {
                this.dialog.launchIndex(index);
                return Clutter.EVENT_STOP;
            });

            this.resultsBox.add_child(row);
        });
    }

    onDigitKey(localIndex) {
        this.dialog.launchIndex((this._windowStart ?? 0) + localIndex);
    }
}