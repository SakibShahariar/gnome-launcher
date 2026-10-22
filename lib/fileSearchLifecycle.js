// SPDX-License-Identifier: GPL-2.0-or-later

// Shared lifecycle for debounced file searches. Dependencies are injected so
// cancellation and stale-result behavior can be tested without GNOME Shell.
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

export function scheduleFileSearch(state, query, {
    removeSource,
    scheduleTimeout,
    sourceRemove,
    createCancellable,
    search,
    isCurrent,
    mapResults = results => results,
    onResults,
    onError,
}) {
    cancelPendingFileSearch(state, removeSource);

    state._fileSearchTimeoutId = scheduleTimeout(() => {
        state._fileSearchTimeoutId = 0;
        if (!isCurrent())
            return sourceRemove;

        const cancellable = createCancellable();
        state._fileSearchCancellable = cancellable;
        Promise.resolve(search(query, cancellable)).then(results => {
            if (cancellable.is_cancelled() || !isCurrent())
                return;
            onResults(mapResults(results));
        }).catch(error => {
            if (!cancellable.is_cancelled() && isCurrent())
                onError(error);
        });
        return sourceRemove;
    });
}
