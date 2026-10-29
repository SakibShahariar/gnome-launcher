// SPDX-License-Identifier: GPL-2.0-or-later

/** Format a local date-time using GNOME's clock-format preference. */
export function formatClockTime(dateTime, clockFormat) {
    const format = clockFormat === '12h' ? '%l:%M %p' : '%H:%M';
    return dateTime.format(format).trim();
}
