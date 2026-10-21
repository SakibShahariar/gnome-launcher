// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * Await a promise without keeping its caller waiting after cancellation.
 *
 * Some GNOME search providers may leave their promise pending while waiting
 * for system state to initialize. Cancellation cannot force those providers
 * to settle, so race the operation against the caller's cancellable.
 *
 * Returns null when cancelled; otherwise returns or throws the operation's
 * result. The underlying operation may finish later, but its settlement is
 * still observed by Promise.race.
 */
export async function awaitWithCancellation(operation, cancellable) {
    if (!cancellable)
        return operation;

    if (cancellable.is_cancelled())
        return null;

    let cancelId = 0;
    let cancel;
    const cancelled = new Promise(resolve => {
        cancel = () => resolve(null);
        cancelId = cancellable.connect(cancel);
        // Close the small race between the initial check and signal hookup.
        if (cancellable.is_cancelled())
            cancel();
    });

    try {
        return await Promise.race([operation, cancelled]);
    } finally {
        if (cancelId) {
            try {
                cancellable.disconnect(cancelId);
            } catch {
                // A caller may already be disposing its cancellable.
            }
        }
    }
}
