// SPDX-License-Identifier: GPL-2.0-or-later

// Clipboard history is module-scoped so it survives launcher dialog
// open/close cycles. Prefer Mutter's selection-owner signal to avoid
// waking up every second; retain polling only as a compatibility fallback.
import Meta from 'gi://Meta';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GdkPixbuf from 'gi://GdkPixbuf';

import {canStoreClipboardImage, findClipboardImageMime} from './clipboardImage.js';

const MAX_HISTORY = 20;
const POLL_INTERVAL_SECONDS = 1;
const CHANGE_DEBOUNCE_MS = 100;

let _history = [];
let _lastSeen = null;
let _lastSeenImage = null;
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
    _lastSeenImage = null;
    _history = _history.filter(item => item.kind !== 'text' || item.text !== text);
    _history.unshift({kind: 'text', name: text, text, timestamp: Date.now()});
    if (_history.length > MAX_HISTORY)
        _history.length = MAX_HISTORY;
}

function _decodeImagePreview(bytes) {
    try {
        const loader = GdkPixbuf.PixbufLoader.new();
        loader.write(bytes.get_data());
        loader.close();
        const source = loader.get_pixbuf();
        if (!source)
            return null;
        const ratio = Math.min(64 / source.get_width(), 48 / source.get_height(), 1);
        const width = Math.max(1, Math.round(source.get_width() * ratio));
        const height = Math.max(1, Math.round(source.get_height() * ratio));
        let preview = source.scale_simple(width, height, GdkPixbuf.InterpType.BILINEAR);
        if (!preview)
            return null;
        if (!preview.get_has_alpha())
            preview = preview.add_alpha(false, 0, 0, 0);
        return preview;
    } catch {
        return null;
    }
}

function _rememberImage(mimeType, bytes) {
    if (!bytes || !canStoreClipboardImage(bytes.get_size()))
        return;
    if (_lastSeenImage && _lastSeenImage.equal(bytes))
        return;
    const preview = _decodeImagePreview(bytes);
    if (!preview)
        return;
    const existing = _history.find(item => item.kind === 'image' && item.mimeType === mimeType && item.bytes.equal(bytes));
    if (existing) {
        _lastSeen = null;
        _lastSeenImage = existing.bytes;
        return;
    }
    const retainedBytes = GLib.Bytes.new(bytes.get_data());
    _lastSeen = null;
    _lastSeenImage = retainedBytes;
    _history.unshift({
        kind: 'image',
        name: 'Image from clipboard',
        mimeType,
        bytes: retainedBytes,
        preview,
        timestamp: Date.now(),
    });
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
        const mimeTypes = clipboard.get_mimetypes(St.ClipboardType.CLIPBOARD) ?? [];
        const imageMime = findClipboardImageMime(mimeTypes);
        if (imageMime) {
            clipboard.get_content(St.ClipboardType.CLIPBOARD, imageMime, (_clipboard, bytes) => {
                if (!_tracking || generation !== _trackingGeneration || sequence !== _pollSequence)
                    return;
                _rememberImage(imageMime, bytes);
            });
            return;
        }
        clipboard.get_text(St.ClipboardType.CLIPBOARD, (_clipboard, text) => {
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
                    // Meta.SelectionType is exposed inconsistently by older
                    // supported Shell introspection versions. Mutter's
                    // clipboard selection enum value is 1 across these APIs.
                    const clipboardSelection = Meta.SelectionType?.SELECTION_CLIPBOARD ?? 1;
                    if (selectionType === clipboardSelection)
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
    _lastSeenImage = null;
}

/** Clear retained entries and ignore any clipboard read already in flight. */
export function clearHistory() {
    _history = [];
    _lastSeen = null;
    _lastSeenImage = null;
    _pollSequence++;
}

export function getHistory() {
    return _history.filter(item => item.kind === 'text').map(item => item.text);
}

export function getEntries() {
    return _history.slice();
}

export function createImagePreview(entry, scale = 1) {
    if (!entry?.preview)
        return new St.Icon({icon_name: 'image-x-generic-symbolic', icon_size: Math.round(24 * scale)});
    const pixbuf = entry.preview;
    const image = new Clutter.Image();
    image.set_data(pixbuf.get_pixels(), Cogl.PixelFormat.RGBA_8888,
        pixbuf.get_width(), pixbuf.get_height(), pixbuf.get_rowstride());
    const actor = new St.Widget({
        width: Math.round(pixbuf.get_width() * scale),
        height: Math.round(pixbuf.get_height() * scale),
        style_class: 'launcher-clipboard-image-preview',
    });
    actor.set_content(image);
    return actor;
}

export function copyToClipboard(text) {
    try {
        const clipboard = St.Clipboard.get_default();
        if (clipboard) {
            _lastSeen = text;
            _lastSeenImage = null;
            clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
        }
    } catch (e) {
        log(`gnome-launcher: copy to clipboard failed: ${e}`);
    }
}

export function restoreEntry(entry) {
    if (!entry)
        return false;
    if (!entry.mimeType || !entry.bytes) {
        copyToClipboard(entry.text ?? entry.name ?? '');
        return true;
    }
    try {
        const clipboard = St.Clipboard.get_default();
        if (!clipboard)
            return false;
        _lastSeen = null;
        _lastSeenImage = entry.bytes;
        clipboard.set_content(St.ClipboardType.CLIPBOARD, entry.mimeType, entry.bytes);
        return true;
    } catch (e) {
        log(`gnome-launcher: failed to restore clipboard image: ${e}`);
        return false;
    }
}
