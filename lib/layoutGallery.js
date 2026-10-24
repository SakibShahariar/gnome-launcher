// SPDX-License-Identifier: GPL-2.0-or-later

import {LAYOUT_NAMES} from './layoutNames.js';

// Keep this metadata in sync with the screenshot assets and layout registry.
// Descriptions state positioning and whether the layout has dedicated mode controls.
const LAYOUT_DETAILS = {
    list: {
        title: 'List',
        description: 'Centered results list · Mode controls: no',
    },
    grid: {
        title: 'Grid',
        description: 'Centered icon grid · Mode controls: no',
    },
    hotkey: {
        title: 'Hotkey',
        description: 'Centered numbered results · Mode controls: no',
    },
    sidebar: {
        title: 'Sidebar',
        description: 'Centered panel with a left mode rail · Mode controls: yes',
    },
    'split-preview': {
        title: 'Split Preview',
        description: 'Centered results with a detail preview · Mode controls: no',
    },
    dock: {
        title: 'Dock',
        description: 'Bottom-edge dock · Mode controls: no',
    },
    fullscreen: {
        title: 'Fullscreen',
        description: 'Full-screen app grid · Mode controls: no',
    },
    'top-dropdown': {
        title: 'Top Dropdown',
        description: 'Compact panel attached to the top edge · Mode controls: no',
    },
    corner: {
        title: 'Corner',
        description: 'Compact panel in the top-left corner · Mode controls: no',
    },
    'full-edge': {
        title: 'Full Edge',
        description: 'Full-width panel along the top edge · Mode controls: no',
    },
    'adaptive-width': {
        title: 'Adaptive Width',
        description: 'Centered row that adapts to result count · Mode controls: no',
    },
    krunner: {
        title: 'KRunner',
        description: 'Dense search panel attached to the top edge · Mode controls: no',
    },
    'split-tabs': {
        title: 'Split Tabs',
        description: 'Centered panel with mode tabs · Mode controls: yes',
    },
    'hero-banner': {
        title: 'Hero Banner',
        description: 'Wallpaper-backed panel with mode controls · Mode controls: yes',
    },
    notch: {
        title: 'Notch',
        description: 'Compact panel centered on the top edge · Mode controls: no',
    },
};

function screenshotName(layout) {
    return `${layout.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase())}.png`;
}

export const LAYOUT_GALLERY = Object.freeze(LAYOUT_NAMES.map(layout => Object.freeze({
    id: layout,
    ...LAYOUT_DETAILS[layout],
    screenshot: screenshotName(layout),
})));
