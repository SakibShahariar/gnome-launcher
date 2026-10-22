// SPDX-License-Identifier: GPL-2.0-or-later

// Clipboard history is module-scoped so it survives launcher dialog
// open/close cycles. Prefer Mutter's selection-owner signal to avoid
// waking up every second; retain polling only as a compatibility fallback.
import Meta from 'gi://Meta';
import St from 'gi://St';
import GLib from 'gi://GLib';

const MAX_HISTORY = 20;
const POLL_INTERVAL_SECONDS = 1;
const CHANGE_DEBOUNCE_MS = 100;

let _history = [];
let _lastSeen = null;
let _timeoutId = null;
let _debounceId = null;
let _selection = null;
let _selectionSignalId = 0;
let _tracking = false;
let _trackingGeneration = 0;
let _pollSequence = 0;

function _rememberText(text) {
    if (typeof text !== 'string' || text.trim().length === 0 || text === _lastSeen)
        return;

    _lastSeen = text;
    _history = _history.filter(item => item !== text);
    _history.unshift(text);
    if (_history.length > MAX_HISTORY)
        _history.length = MAX_HISTORY;
}

function _readClipboard() {
    if (!_tracking)
        return;

    const generation = _trackingGeneration;
    const sequence = ++_pollSequence;
    try {
        const clipboard = St.Clipboard.get_default();
        if (!clipboard)
            return;
        clipboard.get_text(St.ClipboardType.CLIPBOARD, (_clipboard, text) => {
            // Async reads may finish after a newer change or after tracking
            // was disabled/re-enabled. Ignore stale callbacks in both cases.
            if (!_tracking || generation !== _trackingGeneration || sequence !== _pollSequence)
                return;
            _rememberText(text);
        });
    } catch (e) {
        log(`gnome-launcher: clipboard read failed: ${e}`);
    }
}

function _scheduleClipboardRead() {
    if (!_tracking)
        return GLib.SOURCE_REMOVE;

    if (_debounceId) {
        GLib.Source.remove(_debounceId);
        _debounceId = null;
    }

    _debounceId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        CHANGE_DEBOUNCE_MS,
        () => {
            _debounceId = null;
            _readClipboard();
            return GLib.SOURCE_REMOVE;
        }
    );
    return GLib.SOURCE_CONTINUE;
}

function _poll() {
    _readClipboard();
    return _tracking ? GLib.SOURCE_CONTINUE : GLib.SOURCE_REMOVE;
}

/** Call from extension.js's enable(). Safe to call more than once. */
export function startTracking() {
    if (_tracking)
        return;

    _tracking = true;
    _trackingGeneration++;

    // Meta.Selection::owner-changed is available on supported Mutter/GNOME
    // versions and fires for clipboard-owner changes, avoiding periodic reads.
    try {
        _selection = global.display.get_selection();
        if (_selection && typeof _selection.connect === 'function') {
            _selectionSignalId = _selection.connect(
                'owner-changed',
                (_selectionObject, selectionType) => {
                    if (selectionType === Meta.SelectionType.SELECTION_CLIPBOARD)
                        _scheduleClipboardRead();
                }
            );
        }
    } catch (e) {
        log(`gnome-launcher: clipboard change monitoring unavailable; using polling: ${e}`);
        _selection = null;
        _selectionSignalId = 0;
    }

    if (!_selectionSignalId)
        _timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, POLL_INTERVAL_SECONDS, _poll);
    else
        _readClipboard(); // Seed history with the clipboard already present.
}

/** Call from extension.js's disable() - stops all tracking callbacks. */
export function stopTracking() {
    _tracking = false;
    _trackingGeneration++;
    _pollSequence++;

    if (_timeoutId) {
        GLib.Source.remove(_timeoutId);
        _timeoutId = null;
    }
    if (_debounceId) {
        GLib.Source.remove(_debounceId);
        _debounceId = null;
    }
    if (_selection && _selectionSignalId) {
        try {
            _selection.disconnect(_selectionSignalId);
        } catch (e) {
            log(`gnome-launcher: failed to disconnect clipboard change signal: ${e}`);
        }
    }
    _selection = null;
    _selectionSignalId = 0;
    _history = [];
    _lastSeen = null;
}

/** Clear retained entries and ignore any clipboard read already in flight. */
export function clearHistory() {
    _history = [];
    _lastSeen = null;
    _pollSequence++;
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
