// SPDX-License-Identifier: GPL-2.0-or-later

/** Convert an XDG Screenshot portal sRGB tuple into a clipboard-ready hex value. */
export function formatPickedColor(channels) {
    if (!Array.isArray(channels) || channels.length !== 3 ||
        !channels.every(channel => Number.isFinite(channel)))
        return null;

    const bytes = channels.map(channel =>
        Math.round(Math.max(0, Math.min(1, channel)) * 255)
    );
    return `#${bytes.map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
