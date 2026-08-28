// SPDX-License-Identifier: GPL-2.0-or-later

// Reads MD3 color roles from Sakib's live Matugen-generated CSS file
// (used for Zen Browser chrome theming). Unlike matugen-colors.toml -
// which turned out to be a static "reference only" snapshot per its own
// _comment field - this file is confirmed to actually regenerate per
// wallpaper change, so it's the real live source going forward.
//
// Format is CSS custom properties: `--role_name: #hexvalue;` plus
// duplicate `--role_name_rgb: r g b;` lines we don't need - the regex
// below only matches hex values, so the _rgb lines are naturally skipped.

import Gio from 'gi://Gio';

const THEME_FILE_PATH = '/home/sakib/.zen/ke09ovgb.myuser/chrome/colors.css';

const FALLBACK_THEME = {
    surface: '#141218',
    surface_container: '#2b2930',
    surface_container_high: '#322f37',
    on_surface: '#e6e0e9',
    on_surface_variant: '#cac4cf',
    muted: '#938f99',
    outline: '#938f99',
    outline_variant: '#49454f',
    primary: '#d0bcff',
    on_primary: '#381e72',
    primary_container: '#4f378b',
    on_primary_container: '#eaddff',
};

/** Extracts --role: #hexvalue; pairs from a CSS custom-properties block. */
function parseCssColors(text) {
    const roles = {};
    const re = /--([a-z0-9_]+):\s*(#[0-9a-fA-F]{6});/g;
    let match;
    while ((match = re.exec(text)) !== null)
        roles[match[1]] = match[2];
    return roles;
}

/** Returns rgba() CSS for per-value transparency (alpha() with hex fails in St). */
export function withOpacity(color, opacity) {
    if (opacity == null || opacity >= 0.995)
        return color;
    const a = Math.max(0, Math.min(1, opacity));
    // Convert #rrggbb -> rgba(r,g,b,a) — St reliably parses rgba, alpha(hex) is flaky
    const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(color);
    if (!m) return color;
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}

export function loadTheme() {
    const file = Gio.File.new_for_path(THEME_FILE_PATH);

    if (!file.query_exists(null)) {
        log(`gnome-launcher: theme file not found at ${THEME_FILE_PATH}, using fallback`);
        return {...FALLBACK_THEME};
    }

    try {
        const [ok, contents] = file.load_contents(null);
        if (!ok) {
            log('gnome-launcher: theme file failed to load, using fallback');
            return {...FALLBACK_THEME};
        }
        const text = new TextDecoder('utf-8').decode(contents);
        const roles = parseCssColors(text);

        if (Object.keys(roles).length === 0) {
            log('gnome-launcher: theme file parsed but no --role: #hex; pairs found, using fallback');
            return {...FALLBACK_THEME};
        }

        const resolved = {
            surface: roles.surface ?? FALLBACK_THEME.surface,
            surface_container: roles.surface_container ?? FALLBACK_THEME.surface_container,
            surface_container_high: roles.surface_container_high ?? FALLBACK_THEME.surface_container_high,
            on_surface: roles.on_surface ?? FALLBACK_THEME.on_surface,
            on_surface_variant: roles.on_surface_variant ?? FALLBACK_THEME.on_surface_variant,
            muted: roles.outline ?? FALLBACK_THEME.muted,
            outline: roles.outline ?? FALLBACK_THEME.outline,
            outline_variant: roles.outline_variant ?? FALLBACK_THEME.outline_variant,
            primary: roles.primary ?? FALLBACK_THEME.primary,
            on_primary: roles.on_primary ?? FALLBACK_THEME.on_primary,
            primary_container: roles.primary_container ?? FALLBACK_THEME.primary_container,
            on_primary_container: roles.on_primary_container ?? FALLBACK_THEME.on_primary_container,
        };

        log('gnome-launcher: theme loaded from ' + THEME_FILE_PATH);
        for (const [key, value] of Object.entries(resolved)) {
            const source = roles[key] !== undefined ? 'file' : 'FALLBACK';
            log(`gnome-launcher:   ${key} = ${value}  (${source})`);
        }

        return resolved;
    } catch (e) {
        log(`gnome-launcher: failed to parse theme file: ${e}`);
        return {...FALLBACK_THEME};
    }
}

