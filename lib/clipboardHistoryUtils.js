// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * Move a text entry to the front of clipboard history without rebuilding the
 * array. Existing entries are mutated in place so callers keep the same list.
 */
export function rememberTextEntry(history, text, timestamp, maxHistory) {
    const duplicateIndex = history.findIndex(
        item => item.kind === 'text' && item.text === text
    );
    if (duplicateIndex !== -1)
        history.splice(duplicateIndex, 1);

    history.unshift({kind: 'text', name: text, text, timestamp});
    if (history.length > maxHistory)
        history.length = maxHistory;

    return history;
}
