// SPDX-License-Identifier: GPL-2.0-or-later

// Reads MD3 color roles from a Matugen-generated CSS file (or any file
// that defines --role_name: #hex; custom properties). Falls back to a
// hardcoded M3 purple baseline when the file is missing or unparseable.
//
// Theme path is configurable via GSettings key 'theme-file-path' (empty =
// use built-in fallback only). Wallpaper path via 'wallpaper-path'
// (empty = try ~/.config/background.jpg then skip).

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

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

/** Normalize a CSS color token to #rrggbb when possible. */
function normalizeHex(value) {
    value = value.trim();
    // #rgb → #rrggbb
    let m = /^#([0-9a-fA-F]{3})$/.exec(value);
    if (m) {
        const [r, g, b] = m[1];
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    // #rrggbb or #rrggbbaa → keep first 6
    m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(value);
    if (m)
        return `#${m[1]}`.toLowerCase();
    // rgb(r, g, b) or rgba(...)
    m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value);
    if (m) {
        const hex = n => Number(n).toString(16).padStart(2, '0');
        return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
    }
    return null;
}

/**
 * Extracts color roles from a CSS/Matugen file.
 * Supports:
 *   --surface: #hex;
 *   --surface-container: #hex;   (hyphens → underscores)
 *   @define-color surface #hex;
 */
function parseCssColors(text) {
    const roles = {};

    // CSS custom properties: --name: value;
    const reVar = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}+{]+)/g;
    let match;
    while ((match = reVar.exec(text)) !== null) {
        const key = match[1].toLowerCase().replace(/-/g, '_');
        // skip *_rgb helper lines matugen often emits
        if (key.endsWith('_rgb') || key.endsWith('_rgba'))
            continue;
        const hex = normalizeHex(match[2]);
        if (hex)
            roles[key] = hex;
    }

    // GTK-style: @define-color name #hex;
    const reDefine = /@define-color\s+([a-zA-Z0-9_-]+)\s+([^;\s]+)/g;
    while ((match = reDefine.exec(text)) !== null) {
        const key = match[1].toLowerCase().replace(/-/g, '_');
        const hex = normalizeHex(match[2]);
        if (hex && !(key in roles))
            roles[key] = hex;
    }

    return roles;
}

/** Pick first available role from a list of candidate names. */
function pick(roles, names, fallback) {
    for (const n of names) {
        if (roles[n])
            return roles[n];
    }
    return fallback;
}

/** Returns rgba() CSS for per-value transparency (alpha() with hex fails in St). */
export function withOpacity(color, opacity) {
    if (opacity == null || opacity >= 0.995)
        return color;
    const a = Math.max(0, Math.min(1, opacity));
    const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(color);
    if (!m) return color;
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}

/** Returns color for text on a background that uses withOpacity().
 *  Selected text should stay fully opaque for readability. */
export function withOpacityText(color, _opacity) {
    return color;
}

/** Returns rgba() for selected item backgrounds.
 *  Ensures a minimum opacity (0.85) so selected items stay visible
 *  even when global background-opacity is very low. */
export function withSelectedOpacity(color, opacity) {
    const effectiveOpacity = opacity == null ? 1 : Math.max(opacity, 0.85);
    return withOpacity(color, effectiveOpacity);
}

/**
 * Returns an St.Widget that displays the wallpaper as a CSS background
 * image, or null if no usable file is found.
 *
 * Uses background-image (supported by St) instead of the non-existent
 * St.Texture constructor.
 *
 * @param {string} [wallpaperPath] - absolute path; empty/undefined tries
 *   ~/.config/background.jpg then gives up.
 */
export function loadWallpaperWidget(wallpaperPath) {
    const candidates = [];
    if (wallpaperPath && wallpaperPath.trim().length > 0)
        candidates.push(wallpaperPath.trim());
    candidates.push(GLib.get_home_dir() + '/.config/background.jpg');
    candidates.push(GLib.get_home_dir() + '/.config/background');
    candidates.push(GLib.get_user_data_dir() + '/backgrounds/background');

    for (const path of candidates) {
        const file = Gio.File.new_for_path(path);
        if (!file.query_exists(null))
            continue;

        try {
            const info = file.query_info('standard::type,standard::size',
                Gio.FileQueryInfoFlags.NONE, null);
            if (info.get_file_type() !== Gio.FileType.REGULAR || info.get_size() < 1)
                continue;

            const uri = file.get_uri();
            const widget = new St.Widget({
                x_expand: true,
                y_expand: true,
                style: `background-image: url("${uri}"); ` +
                       'background-size: cover; background-position: center; ' +
                       'background-repeat: no-repeat;',
            });
            return widget;
        } catch (e) {
            log(`gnome-launcher: failed to load wallpaper from ${path}: ${e}`);
        }
    }
    return null;
}

/**
 * Returns a file:// URI for the first usable wallpaper, or null.
 * Useful when applying background-image CSS directly on a container.
 */
export function resolveWallpaperUri(wallpaperPath) {
    const candidates = [];
    if (wallpaperPath && wallpaperPath.trim().length > 0)
        candidates.push(wallpaperPath.trim());
    candidates.push(GLib.get_home_dir() + '/.config/background.jpg');
    candidates.push(GLib.get_home_dir() + '/.config/background');
    candidates.push(GLib.get_user_data_dir() + '/backgrounds/background');

    for (const path of candidates) {
        const file = Gio.File.new_for_path(path);
        if (!file.query_exists(null))
            continue;
        try {
            const info = file.query_info('standard::type,standard::size',
                Gio.FileQueryInfoFlags.NONE, null);
            if (info.get_file_type() !== Gio.FileType.REGULAR || info.get_size() < 1)
                continue;
            return file.get_uri();
        } catch (e) {
            log(`gnome-launcher: wallpaper probe failed for ${path}: ${e}`);
        }
    }
    return null;
}

/**
 * Async wrapper kept for existing .then() call sites.
 * Prefer loadWallpaperWidget() for new code.
 */
export async function loadWallpaperTexture(wallpaperPath) {
    return loadWallpaperWidget(wallpaperPath);
}

/**
 * @param {string} [themeFilePath] - absolute path to a CSS file with
 *   --role: #hex; properties. Empty/undefined → fallback theme only.
 */
const DEFAULT_THEME_CANDIDATES = [
    '/home/sakib/.config/matugen/matugen-colors.css',
    GLib.get_home_dir() + '/.config/matugen/matugen-colors.css',
    GLib.get_home_dir() + '/.config/matugen/colors.css',
    GLib.get_home_dir() + '/.config/matugen/colors.toml',
];

function resolveThemePath(themeFilePath) {
    if (themeFilePath && themeFilePath.trim().length > 0)
        return themeFilePath.trim();
    for (const p of DEFAULT_THEME_CANDIDATES) {
        if (Gio.File.new_for_path(p).query_exists(null))
            return p;
    }
    return null;
}

export function loadTheme(themeFilePath) {
    const path = resolveThemePath(themeFilePath);
    if (!path) {
        log('gnome-launcher: no theme file found, using fallback');
        return {...FALLBACK_THEME};
    }

    const file = Gio.File.new_for_path(path);

    if (!file.query_exists(null)) {
        log(`gnome-launcher: theme file not found at ${path}, using fallback`);
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
            log(`gnome-launcher: theme file ${path} parsed but no color roles found, using fallback`);
            return {...FALLBACK_THEME};
        }

        // Map common Matugen / MD3 / alternate names onto our role set
        const resolved = {
            surface: pick(roles, ['surface', 'background', 'surface_dim'], FALLBACK_THEME.surface),
            surface_container: pick(roles, ['surface_container', 'surface_container_low', 'surface_variant', 'surface_bright'], FALLBACK_THEME.surface_container),
            surface_container_high: pick(roles, ['surface_container_high', 'surface_container_highest', 'surface_container'], FALLBACK_THEME.surface_container_high),
            on_surface: pick(roles, ['on_surface', 'on_background', 'on_surface_variant'], FALLBACK_THEME.on_surface),
            on_surface_variant: pick(roles, ['on_surface_variant', 'on_surface'], FALLBACK_THEME.on_surface_variant),
            muted: pick(roles, ['outline', 'outline_variant', 'on_surface_variant'], FALLBACK_THEME.muted),
            outline: pick(roles, ['outline', 'outline_variant'], FALLBACK_THEME.outline),
            outline_variant: pick(roles, ['outline_variant', 'outline'], FALLBACK_THEME.outline_variant),
            primary: pick(roles, ['primary', 'secondary', 'tertiary'], FALLBACK_THEME.primary),
            on_primary: pick(roles, ['on_primary', 'on_secondary'], FALLBACK_THEME.on_primary),
            primary_container: pick(roles, ['primary_container', 'secondary_container', 'primary_fixed'], FALLBACK_THEME.primary_container),
            on_primary_container: pick(roles, ['on_primary_container', 'on_secondary_container'], FALLBACK_THEME.on_primary_container),
        };

        log(`gnome-launcher: theme loaded from ${path} (${Object.keys(roles).length} roles parsed)`);
        for (const [key, value] of Object.entries(resolved))
            log(`gnome-launcher:   ${key} = ${value}`);
        return resolved;
    } catch (e) {
        log(`gnome-launcher: failed to parse theme file: ${e}`);
        return {...FALLBACK_THEME};
    }
}
