// SPDX-License-Identifier: GPL-2.0-or-later

// Small, dependency-free finder registry shared by prefix parsing and
// future finder implementations. Keep this module usable from Node tests.
export function createFinderRegistry(definitions) {
    const byMode = new Map();
    const prefixes = [];
    const keywords = [];

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
            const duplicate = prefixes.some(existing => {
                const insensitive = existing.caseInsensitive || finder.caseInsensitive;
                const existingPrefix = insensitive ? existing.prefix.toLowerCase() : existing.prefix;
                const prefix = insensitive ? finder.prefix.toLowerCase() : finder.prefix;
                return existingPrefix.startsWith(prefix) || prefix.startsWith(existingPrefix);
            });
            if (duplicate)
                throw new Error(`Duplicate finder prefix: ${finder.prefix}`);
            prefixes.push(finder);
        }
        if (typeof finder.keyword === 'string') {
            const duplicate = keywords.some(existing =>
                existing.keyword === finder.keyword ||
                ((existing.caseInsensitive || finder.caseInsensitive) &&
                    existing.keyword.toLowerCase() === finder.keyword.toLowerCase()));
            if (duplicate)
                throw new Error(`Duplicate finder keyword: ${finder.keyword}`);
            keywords.push(finder);
        }
    }

    for (const prefixFinder of prefixes) {
        for (const keywordFinder of keywords) {
            const insensitive = prefixFinder.caseInsensitive || keywordFinder.caseInsensitive;
            const prefix = insensitive
                ? prefixFinder.prefix.toLowerCase()
                : prefixFinder.prefix;
            const keyword = insensitive
                ? keywordFinder.keyword.toLowerCase()
                : keywordFinder.keyword;
            if (prefix.startsWith(keyword) || keyword.startsWith(prefix))
                throw new Error(
                    `Ambiguous finder prefix and keyword: ${prefixFinder.mode}, ${keywordFinder.mode}`
                );
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
