// SPDX-License-Identifier: GPL-2.0-or-later

// Computes which slice of results should be visible using "sticky"
// scrolling: the window stays fixed while selection moves within it, and
// only shifts - by exactly enough to bring the new selection into view -
// once selection would move off the top or bottom edge. This needs to
// know the *previous* window start to work, since "did we hit an edge"
// is a comparison against where the window currently is, not something
// derivable from selectedIndex alone (an earlier version of this file
// always recentered the window around selectedIndex on every render,
// which scrolled far more often than expected - this replaces that).

/**
 * @param {number} prevStart - the window's start index from the last render
 *   (0 if this is the first render / no previous state)
 * @param {number} selectedIndex - dialog._selectedIndex
 * @param {number} total - dialog._filtered.length
 * @param {number} windowSize - how many results this layout shows at once
 * @param {number} columns - 1 for list-style layouts; the column count
 *   for grid-style ones, so the window snaps to a row boundary and tiles
 *   don't shift mid-row.
 * @returns {number} the new start index to slice from
 */
export function windowStart(prevStart, selectedIndex, total, windowSize, columns = 1) {
    if (columns > 1) {
        // Grid layouts: do this math in row-units, not item-units. The
        // previous version computed an item-space start then snapped it
        // to a row boundary afterward - which could snap *backward* onto
        // the previous window, so scrolling down sometimes never actually
        // revealed the new row. Treating each row as one logical unit
        // (the same way list-style layouts treat each item as one unit)
        // avoids that entirely.
        const totalRows = Math.ceil(total / columns);
        const visibleRows = Math.floor(windowSize / columns);
        let startRow = Math.floor((prevStart ?? 0) / columns);
        const selectedRow = Math.floor(selectedIndex / columns);

        if (selectedRow < startRow)
            startRow = selectedRow;
        else if (selectedRow >= startRow + visibleRows)
            startRow = selectedRow - visibleRows + 1;

        startRow = Math.max(0, Math.min(startRow, Math.max(0, totalRows - visibleRows)));
        return startRow * columns;
    }

    // List-style layouts (columns = 1): sticky scrolling in item-units.
    let start = prevStart ?? 0;

    if (selectedIndex < start)
        start = selectedIndex;
    else if (selectedIndex >= start + windowSize)
        start = selectedIndex - windowSize + 1;

    return Math.max(0, Math.min(start, Math.max(0, total - windowSize)));
}

// Layouts that wrap their results in St.ScrollView (sidebar, splitPreview,
// splitTabs, fullEdge, fullscreen) do their own "scrolling" by rebuilding
// exactly which items are visible each render (see windowStart above) -
// but St.ScrollView also tracks its own independent scroll position,
// which doesn't reset when content is rebuilt. Left alone, that stale
// internal scroll offset can partially hide freshly-rebuilt rows right
// at the moment windowStart shifts the window (reported: wrong-looking
// focused row exactly when hitting the bottom edge in sidebar). Call
// this after every renderResults() rebuild to keep the two scroll
// mechanisms from fighting each other.
export function resetScrollToTop(scrollView) {
    if (!scrollView)
        return;
    try {
        const adjustment = scrollView.vscroll?.adjustment;
        if (adjustment)
            adjustment.set_value(0);
    } catch (e) {
        log(`gnome-launcher: failed to reset scroll position: ${e}`);
    }
}

