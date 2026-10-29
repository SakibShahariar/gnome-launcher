// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * Put the focused window first, then sort remaining windows by title.
 * Focus state is captured once so focus changes during sorting cannot violate
 * the comparator contract. Array#sort is stable, preserving actor order for
 * windows with equivalent titles.
 */
export function sortWindows(windows) {
    return windows
        .map((entry, index) => ({
            entry,
            index,
            focused: Boolean(entry.window?.has_focus?.()),
            name: String(entry.name ?? ''),
        }))
        .sort((a, b) => {
            if (a.focused !== b.focused)
                return Number(b.focused) - Number(a.focused);

            const byName = a.name.localeCompare(b.name, undefined, {sensitivity: 'base'});
            return byName || a.index - b.index;
        })
        .map(item => item.entry);
}
