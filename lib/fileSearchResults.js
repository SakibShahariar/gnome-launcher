// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * Parse find -print0 output without corrupting paths that contain newlines.
 *
 * @param {string} output - NUL-delimited paths emitted by find.
 * @param {number} limit - Maximum number of paths to return.
 */
export function parseFindOutput(output, limit) {
    if (typeof output !== 'string' || !Number.isFinite(limit) || limit <= 0)
        return [];

    const maxResults = Math.floor(limit);
    if (maxResults === 0)
        return [];

    return output
        .split('\0')
        .filter(path => path.length > 0)
        .slice(0, maxResults);
}
