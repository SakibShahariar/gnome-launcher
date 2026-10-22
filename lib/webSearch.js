// SPDX-License-Identifier: GPL-2.0-or-later

const DEFAULT_SEARCH_TEMPLATE = 'https://www.google.com/search?q={query}';

export function buildSearchUrl(query, template = DEFAULT_SEARCH_TEMPLATE) {
    if (typeof query !== 'string' || typeof template !== 'string')
        return null;

    const trimmed = query.trim();
    if (!trimmed || template.length > 2048 || !template.includes('{query}'))
        return null;
    if (!/^https?:\/\//i.test(template))
        return null;

    const url = template.replaceAll('{query}', encodeURIComponent(trimmed));
    if (!/^https?:\/\//i.test(url) || /[\r\n]/.test(url))
        return null;
    return url;
}

export {DEFAULT_SEARCH_TEMPLATE};
