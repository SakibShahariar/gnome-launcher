// SPDX-License-Identifier: GPL-2.0-or-later

// Maps the 'layout' GSettings string to layout classes. Add a new layout
// by writing a new file in this directory with a class implementing
// buildUI()/renderResults() (see list.js for the simplest example), then
// registering it here - nothing else in the extension needs to change.

import {ListLayout} from './list.js';
import {GridLayout} from './grid.js';
import {HotkeyLayout} from './hotkey.js';
import {SidebarLayout} from './sidebar.js';
import {SplitPreviewLayout} from './splitPreview.js';
import {DockLayout} from './dock.js';
import {FullscreenLayout} from './fullscreen.js';
import {TopDropdownLayout} from './topDropdown.js';
import {CornerLayout} from './corner.js';
import {FullEdgeLayout} from './fullEdge.js';
import {AdaptiveWidthLayout} from './adaptiveWidth.js';
import {KrunnerLayout} from './krunner.js';
import {SplitTabsLayout} from './splitTabs.js';
import {HeroBannerLayout} from './heroBanner.js';
import {NotchLayout} from './notch.js';

export const LAYOUTS = {
    list: ListLayout,
    grid: GridLayout,
    hotkey: HotkeyLayout,
    sidebar: SidebarLayout,
    'split-preview': SplitPreviewLayout,
    dock: DockLayout,
    fullscreen: FullscreenLayout,
    'top-dropdown': TopDropdownLayout,
    corner: CornerLayout,
    'full-edge': FullEdgeLayout,
    'adaptive-width': AdaptiveWidthLayout,
    krunner: KrunnerLayout,
    'split-tabs': SplitTabsLayout,
    'hero-banner': HeroBannerLayout,
    notch: NotchLayout,
};

export const DEFAULT_LAYOUT = 'list';
