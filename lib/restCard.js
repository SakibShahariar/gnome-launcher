// SPDX-License-Identifier: GPL-2.0-or-later

import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {formatClockTime} from './clockFormat.js';
import {platedAppIcon} from './theme.js';
import {getRecentApps} from './recentAppsRuntime.js';

/** Shared empty-query landing card with full and compact layout variants. */
export function makeRestCard(theme, {
    variant = 'full',
    showFinderHints = true,
    showRecentApps = false,
    pinnedApps = [],
    onActivate = theme.launchApp ?? null,
} = {}) {
    const compact = variant === 'compact';
    const card = new St.BoxLayout({
        orientation: Clutter.Orientation.VERTICAL,
        x_expand: true,
        style_class: 'launcher-rest-card',
        style: compact ? 'padding: 10px 12px;' : 'padding: 18px 20px;',
    });

    if (!compact) {
        const now = GLib.DateTime.new_now_local();
        const hour = now.get_hour();
        const greeting = hour < 12 ? 'Good morning'
            : hour < 18 ? 'Good afternoon'
            : 'Good evening';
        const date = now.format('%A, %B %e').trim();
        const clockFormat = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'}).get_string('clock-format');
        const time = formatClockTime(now, clockFormat);
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
    } else {
        card.add_child(new St.Label({
            text: 'Search applications',
            x_align: Clutter.ActorAlign.START,
            style: `color: ${theme.on_surface}; font-size: 13px; font-weight: 600; padding-bottom: 4px;`,
        }));
    }

    card.add_child(new St.Label({
        text: 'Start typing to search',
        x_align: Clutter.ActorAlign.START,
        style: `color: ${theme.on_surface_variant}; font-size: 13px; padding-bottom: 8px;`,
    }));

    if (pinnedApps.length > 0) {
        card.add_child(new St.Label({
            text: 'Favorites',
            x_align: Clutter.ActorAlign.START,
            style: `color: ${theme.on_surface}; font-size: 12px; font-weight: 600; padding-top: 12px; padding-bottom: 4px;`,
        }));
        for (const app of pinnedApps) {
            const button = new St.Button({
                reactive: true,
                can_focus: true,
                x_expand: true,
                accessible_name: `Favorite: ${app.get_name()}`,
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

    if (showRecentApps && !compact) {
        const apps = getRecentApps(8);
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

    if (showFinderHints) {
        const fontSize = compact ? 10 : 11;
        const style = `color: ${theme.muted || theme.on_surface_variant}; font-size: ${fontSize}px;`;
        const addHint = (text, extraStyle = '') => {
            const label = new St.Label({
                text,
                x_align: Clutter.ActorAlign.START,
                style: `${style} ${extraStyle}`,
            });
            label.clutter_text.set_line_wrap(true);
            card.add_child(label);
        };
        addHint('> run  ·  / files  ·  ; clipboard  ·  ! power', 'padding-bottom: 3px;');
        addHint('= calculate  ·  ? web  ·  w windows', 'padding-bottom: 3px;');
        addHint('recent  ·  emoji  ·  s settings · color');
    }

    return card;
}
