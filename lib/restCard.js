// SPDX-License-Identifier: GPL-2.0-or-later

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

/** A compact empty-query landing card for search-first layouts. */
export function makeRestCard(theme) {
    const now = GLib.DateTime.new_now_local();
    const hour = now.get_hour();
    const greeting = hour < 12 ? 'Good morning'
        : hour < 18 ? 'Good afternoon'
        : 'Good evening';
    const date = now.format('%A, %B %e').trim();
    const time = now.format('%H:%M');

    const card = new St.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL,
        x_expand: true,
        style_class: 'launcher-rest-card',
        style: 'padding: 18px 20px;',
    });
    card.add_child(new St.Label({
        text: greeting,
        x_align: Clutter.ActorAlign.START,
        style: `color: ${theme.on_surface}; font-size: 16px; font-weight: 600; padding-bottom: 4px;`,
    }));
    card.add_child(new St.Label({
        text: `${date} · ${time}`,
        x_align: Clutter.ActorAlign.START,
        style: `color: ${theme.muted || theme.on_surface_variant}; font-size: 12px; padding-bottom: 12px;`,
    }));
    card.add_child(new St.Label({
        text: 'Start typing to search applications',
        x_align: Clutter.ActorAlign.START,
        style: `color: ${theme.on_surface_variant}; font-size: 13px;`,
    }));
    return card;
}
