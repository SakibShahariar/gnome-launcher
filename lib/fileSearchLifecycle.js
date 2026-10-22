// SPDX-License-Identifier: GPL-2.0-or-later

// Shared lifecycle cleanup for debounced file searches. Kept independent of
// GNOME imports so cancellation edge cases can be tested with Node.
export function cancelPendingFileSearch(state, removeSource) {
    if (state._fileSearchTimeoutId) {
        removeSource(state._fileSearchTimeoutId);
        state._fileSearchTimeoutId = 0;
    }

    if (state._fileSearchCancellable) {
        state._fileSearchCancellable.cancel();
        state._fileSearchCancellable = null;
    }
}
