// SPDX-License-Identifier: GPL-2.0-or-later

// Single source for layout identifiers — imported by both
// prefs.js (Adw dropdown) and registry.js validation.
// No St/Clutter/Main imports so it loads in the prefs GJS process.

export const LAYOUT_NAMES = [
    'list', 'grid', 'hotkey', 'sidebar', 'split-preview', 'dock',
    'fullscreen', 'top-dropdown', 'corner', 'full-edge', 'adaptive-width',
    'krunner', 'split-tabs', 'hero-banner', 'notch',
];
