// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * Parse find -print0 output without corrupting paths that contain newlines.
 *
 * @param {string} output - NUL-delimited paths emitted by find.
 * @param {number} limit - Maximum number of paths to return.
 */
/**
 * Group a path by its broad source area. /go, /usr and each home folder get
 * their own group, so a single large tree with many subdirectories cannot
 * dominate the result list.
 */
export function sourceArea(path) {
    if (typeof path !== 'string' || !path.startsWith('/'))
        return '/';
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'home' && parts.length >= 3)
        return `/${parts.slice(0, 3).join('/')}`;
    return `/${parts[0] ?? ''}`;
}

/**
 * Interleave paths by source area so a single dense tree cannot fill the
 * result list before other locations are reached.
 */
export function diversifyFindPaths(paths, limit) {
    if (!Array.isArray(paths) || !Number.isFinite(limit) || limit <= 0)
        return [];
    const byArea = new Map();
    for (const path of paths) {
        if (typeof path !== 'string' || !path)
            continue;
        const area = sourceArea(path);
        if (!byArea.has(area))
            byArea.set(area, []);
        byArea.get(area).push(path);
    }

    const groups = [...byArea.values()];
    const result = [];
    for (let index = 0; result.length < limit; index++) {
        let added = false;
        for (const group of groups) {
            if (result.length >= limit)
                break;
            if (index < group.length) {
                result.push(group[index]);
                added = true;
            }
        }
        if (!added)
            break;
    }
    return result;
}

/** Apply the same directory interleaving to native file result entries. */
export function diversifyFileEntries(entries, limit) {
    if (!Array.isArray(entries) || !Number.isFinite(limit) || limit <= 0)
        return [];
    const paths = diversifyFindPaths(entries.map(entry => entry?.path).filter(Boolean), limit);
    return paths.map(path => entries.find(entry => entry.path === path)).filter(Boolean);
}

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
