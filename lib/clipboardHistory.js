// SPDX-License-Identifier: GPL-2.0-or-later

// Tracks clipboard history by polling, since St.Clipboard has no
// change-notification signal to listen to instead. Lives at module
// level (not inside LauncherDialog) so history persists across dialog
// open/close cycles - the dialog itself is destroyed and recreated every
// time the launcher toggles, but this keeps running the whole time the
// extension is enabled.

import St from 'gi://St';
import GLib from 'gi://GLib';

const MAX_HISTORY = 20;
const POLL_INTERVAL_SECONDS = 1;

let _history = [];
let _lastSeen = null;
let _timeoutId = null;
let _tracking = false;
let _trackingGeneration = 0;
let _pollSequence = 0;

function _poll() {
    if (!_tracking)
        return GLib.SOURCE_REMOVE;

    const generation = _trackingGeneration;
    const sequence = ++_pollSequence;
    try {
        const clipboard = St.Clipboard.get_default();
        if (!clipboard)
            return GLib.SOURCE_CONTINUE;
        clipboard.get_text(St.ClipboardType.CLIPBOARD, (_clipboard, text) => {
            // Clipboard reads are asynchronous and can complete out of order.
            // Only the newest poll may update history, and callbacks from a
            // previous enable cycle must not repopulate cleared history.
            if (!_tracking || generation !== _trackingGeneration || sequence !== _pollSequence)
                return;
            if (text && text.trim().length > 0 && text !== _lastSeen) {
                _lastSeen = text;
                _history = _history.filter(item => item !== text);
                _history.unshift(text);
                if (_history.length > MAX_HISTORY)
                    _history.length = MAX_HISTORY;
            }
        });
    } catch (e) {
        log(`gnome-launcher: clipboard poll failed: ${e}`);
    }
    return GLib.SOURCE_CONTINUE;
}

/** Call from extension.js's enable(). Safe to call more than once. */
export function startTracking() {
    if (_timeoutId)
        return;
    _tracking = true;
    _trackingGeneration++;
    _timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, POLL_INTERVAL_SECONDS, _poll);
}

/** Call from extension.js's disable() - stops the polling loop. */
export function stopTracking() {
    _tracking = false;
    _trackingGeneration++;
    _pollSequence++;
    if (_timeoutId) {
        GLib.Source.remove(_timeoutId);
        _timeoutId = null;
    }
    _history = [];
    _lastSeen = null;
}

export function getHistory() {
    return _history;
}

export function copyToClipboard(text) {
    try {
        const clipboard = St.Clipboard.get_default();
        if (clipboard)
            clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
    } catch (e) {
        log(`gnome-launcher: copy to clipboard failed: ${e}`);
    }
}
