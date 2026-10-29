// SPDX-License-Identifier: GPL-2.0-or-later

// Modes shared by Sidebar, Split Tabs, and Hero Banner. Keep this allowlist
// aligned with the preference model so invalid GSettings values safely fall
// back to the applications finder.
const DEFAULT_MODES = new Set([
    'apps', 'run', 'files', 'clipboard', 'window',
    'calculator', 'web', 'recent', 'emoji', 'settings',
]);

export function resolveDefaultMode(mode) {
    return DEFAULT_MODES.has(mode) ? mode : 'apps';
}
