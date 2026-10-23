// SPDX-License-Identifier: GPL-2.0-or-later

const EMPTY_MESSAGES = Object.freeze({
    apps: 'No matches',
    files: 'Type to search files',
    clipboard: 'Clipboard is empty',
    power: 'No power actions',
    window: 'No open windows',
    calculator: 'Type a valid arithmetic expression',
    web: 'Type a web search query',
    recent: 'No recent documents',
    emoji: 'No matching emoji',
    settings: 'No matching Settings panels',
});

/** Shared copy for mode-specific empty results across launcher layouts. */
export function getModeEmptyMessage(mode, {clipboardEnabled = true} = {}) {
    if (mode === 'clipboard' && !clipboardEnabled)
        return 'Clipboard history is off; enable it in Preferences';
    return EMPTY_MESSAGES[mode] ?? EMPTY_MESSAGES.apps;
}
