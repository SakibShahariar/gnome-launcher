// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * Parse find -print0 output without corrupting paths that contain newlines.
 *
 * @param {string} output - NUL-delimited paths emitted by find.
 * @param {number} limit - Maximum number of paths to return.
 */
/**
 * Interleave paths by parent directory so a single dense directory cannot
 * fill the result list before other locations are reached. Round-robin
 * one path per directory until the limit is met or all paths are used.
 */
export function diversifyFindPaths(paths, limit) {
    if (!Array.isArray(paths) || !Number.isFinite(limit) || limit <= 0)
        return [];
    const byDirectory = new Map();
    for (const path of paths) {
        if (typeof path !== 'string' || !path)
            continue;
        const slash = path.lastIndexOf('/');
        const directory = slash <= 0 ? '/' : path.slice(0, slash);
        if (!byDirectory.has(directory))
            byDirectory.set(directory, []);
        byDirectory.get(directory).push(path);
    }

    const groups = [...byDirectory.values()];
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
