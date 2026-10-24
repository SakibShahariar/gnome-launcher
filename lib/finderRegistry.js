// SPDX-License-Identifier: GPL-2.0-or-later

// Small, dependency-free finder registry shared by prefix parsing and
// future finder implementations. Keep this module usable from Node tests.
export function createFinderRegistry(definitions) {
    const byMode = new Map();
    const prefixes = [];
    const keywords = [];
    const seenPrefixes = new Set();
    const seenKeywords = new Set();

    for (const definition of definitions) {
        if (!definition || typeof definition.mode !== 'string' || !definition.mode)
            throw new TypeError('Each finder must have a mode');
        if (byMode.has(definition.mode))
            throw new Error(`Duplicate finder mode: ${definition.mode}`);
        if (typeof definition.prefix === 'string' && !definition.prefix.trim())
            throw new TypeError(`Finder prefix must not be empty: ${definition.mode}`);
        if (typeof definition.keyword === 'string' && !definition.keyword.trim())
            throw new TypeError(`Finder keyword must not be empty: ${definition.mode}`);

        const finder = Object.freeze({...definition});
        byMode.set(finder.mode, finder);

        if (typeof finder.prefix === 'string') {
            const normalizedPrefix = finder.prefix.toLowerCase();
            if (seenPrefixes.has(normalizedPrefix))
                throw new Error(`Duplicate finder prefix: ${finder.prefix}`);
            seenPrefixes.add(normalizedPrefix);
            prefixes.push(finder);
        }
        if (typeof finder.keyword === 'string') {
            const normalizedKeyword = finder.keyword.toLowerCase();
            if (seenKeywords.has(normalizedKeyword))
                throw new Error(`Duplicate finder keyword: ${finder.keyword}`);
            seenKeywords.add(normalizedKeyword);
            keywords.push(finder);
        }
    }

    return Object.freeze({
        get(mode) {
            return byMode.get(mode) ?? null;
        },
        list() {
            return [...byMode.values()];
        },
        parsePrefix(input) {
            if (typeof input !== 'string')
                return null;

            for (const finder of prefixes) {
                const candidate = input.slice(0, finder.prefix.length);
                const matches = finder.caseInsensitive
                    ? candidate.toLowerCase() === finder.prefix.toLowerCase()
                    : candidate === finder.prefix;
                if (matches) {
                    return {
                        mode: finder.mode,
                        query: input.slice(finder.prefix.length).trimStart(),
                    };
                }
            }

            for (const finder of keywords) {
                const flags = finder.caseInsensitive ? 'i' : '';
                const matcher = new RegExp(`^${escapeRegExp(finder.keyword)}\\s+`, flags);
                const match = input.match(matcher);
                if (match) {
                    return {
                        mode: finder.mode,
                        query: input.slice(match[0].length).trimStart(),
                    };
                }
            }

            return null;
        },
    });
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
