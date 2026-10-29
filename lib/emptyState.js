// SPDX-License-Identifier: GPL-2.0-or-later

import St from 'gi://St';
import Clutter from 'gi://Clutter';

/**
 * Shared empty-results label used by every layout so messaging and
 * styling stay consistent.
 *
 * @param {object} theme - theme roles from loadTheme()
 * @param {string} [text]
 * @returns {St.Label}
 */
export function makeEmptyLabel(theme, text = 'No matches') {
    return new St.Label({
        text,
        accessible_name: text,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
        style_class: 'launcher-empty-state',
        style: `color: ${theme.muted || theme.on_surface_variant};`,
    });
}
