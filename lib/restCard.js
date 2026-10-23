// SPDX-License-Identifier: GPL-2.0-or-later

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';

import {platedAppIcon} from './theme.js';
import {resolveRecentApps} from './recentApps.js';

/** A compact empty-query landing card for search-first layouts. */
export function makeRestCard(theme, {showFinderHints = false, settingsOnlyHints = false, showRecentApps = false, onActivate = null} = {}) {
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
        style: `color: ${theme.on_surface_variant}; font-size: 13px; padding-bottom: 8px;`,
    }));
    if (showRecentApps) {
        let apps = [];
        try {
            apps = resolveRecentApps(Shell.AppUsage.get_default().get_most_used(''), 8);
        } catch (e) {
            log(`gnome-launcher: recent apps are unavailable: ${e}`);
        }

        if (apps.length > 0) {
            card.add_child(new St.Label({
                text: 'Recently used',
                x_align: Clutter.ActorAlign.START,
                style: `color: ${theme.on_surface}; font-size: 12px; font-weight: 600; padding-top: 12px; padding-bottom: 4px;`,
            }));
            for (const app of apps) {
                const button = new St.Button({
                    reactive: true,
                    can_focus: true,
                    x_expand: true,
                    accessible_name: app.get_name(),
                    style: 'padding: 5px 0; background-color: transparent;',
                });
                const row = new St.BoxLayout({x_expand: true, style: 'spacing: 10px;'});
                row.add_child(platedAppIcon(app.get_icon(), Math.round(18 * theme.scale), theme.surface, {
                    platesEnabled: theme.appIconPlates,
                    extraStyle: 'margin-right: 8px;',
                }));
                row.add_child(new St.Label({
                    text: app.get_name(),
                    y_align: Clutter.ActorAlign.CENTER,
                    style: `color: ${theme.on_surface_variant};`,
                }));
                button.set_child(row);
                button.connect('clicked', () => {
                    if (typeof onActivate === 'function')
                        onActivate(app);
                    else
                        app.activate();
                });
                card.add_child(button);
            }
        }
    }
    if (showFinderHints && settingsOnlyHints) {
        card.add_child(new St.Label({
            text: 's settings  ·  settings query opens GNOME Settings',
            x_align: Clutter.ActorAlign.START,
            style: `color: ${theme.muted || theme.on_surface_variant}; font-size: 11px;`,
        }));
    } else if (showFinderHints) {
        card.add_child(new St.Label({
            text: '> run  ·  / files  ·  = calculate  ·  ? web',
            x_align: Clutter.ActorAlign.START,
            style: `color: ${theme.muted || theme.on_surface_variant}; font-size: 11px; padding-bottom: 3px;`,
        }));
        card.add_child(new St.Label({
            text: 'w windows  ·  recent  ·  emoji  ·  s settings',
            x_align: Clutter.ActorAlign.START,
            style: `color: ${theme.muted || theme.on_surface_variant}; font-size: 11px;`,
        }));
    }
    return card;
}
