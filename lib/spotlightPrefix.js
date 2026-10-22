// SPDX-License-Identifier: GPL-2.0-or-later

// Pure Spotlight prefix parsing, kept separate from GNOME Shell APIs so the
// interaction contract can be regression-tested in Node.
const PREFIXES = [
    {prefix: '=', finder: 'calculator'},
    {prefix: ';', finder: 'clipboard'},
    {prefix: ':', finder: 'clipboard'},
    {prefix: '/', finder: 'files'},
    {prefix: '>', finder: 'run'},
    {prefix: 'run ', finder: 'run'},
    {prefix: 'w ', finder: 'windows'},
    {prefix: 'windows ', finder: 'windows'},
    {prefix: '?', finder: 'web'},
    {prefix: '!', finder: 'power'},
];

/**
 * Parse a finder prefix from the start of a Spotlight query.
 *
 * Unknown prefixes intentionally remain ordinary app queries. Prefixes are
 * case-insensitive where they use words, and only one prefix is consumed.
 *
 * @returns {{finder: string, query: string, prefixed: boolean}}
 */
export function parsePrefix(input) {
    const text = typeof input === 'string' ? input : '';
    const trimmed = text.trimStart();
    const lower = trimmed.toLowerCase();

    for (const {prefix, finder} of PREFIXES) {
        if (lower.startsWith(prefix)) {
            return {
                finder,
                query: trimmed.slice(prefix.length).trimStart(),
                prefixed: true,
            };
        }
    }

    return {finder: 'apps', query: text, prefixed: false};
}
