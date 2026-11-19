// SPDX-License-Identifier: GPL-2.0-or-later

// User-defined URL/search shortcuts. Pure module so validation, matching and
// URL construction can be tested without GNOME Shell. Definitions stay local
// in GSettings; nothing here performs network requests while typing.

export const QUICKLINK_VERSION = 1;
export const MAX_QUICKLINKS = 50;
const MAX_TRIGGER_LENGTH = 24;
const MAX_NAME_LENGTH = 60;
const MAX_QUERY_LENGTH = 2048;
const TRIGGER_PATTERN = new RegExp(`^[a-z0-9][a-z0-9_-]{0,${MAX_TRIGGER_LENGTH - 1}}$`);

function decode(value) {
    if (Array.isArray(value))
        return value;
    if (typeof value !== 'string' || !value.trim())
        return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed))
            return parsed;
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.links))
            return parsed.links;
    } catch {
        // Malformed settings are treated as an empty list.
    }
    return [];
}

function validTemplate(template) {
    if (typeof template !== 'string' || template.split('{query}').length !== 2)
        return false;
    try {
        // Replace the placeholder with a harmless token purely for URL parsing.
        const url = new URL(template.replace('{query}', 'quicklink-query'));
        return (url.protocol === 'http:' || url.protocol === 'https:') &&
            !url.username && !url.password && Boolean(url.hostname);
    } catch {
        return false;
    }
}

function normalizeOne(raw, seen) {
    if (!raw || typeof raw !== 'object')
        return null;
    const trigger = typeof raw.trigger === 'string'
        ? raw.trigger.trim().toLowerCase() : '';
    if (!TRIGGER_PATTERN.test(trigger) || seen.has(trigger))
        return null;
    if (!validTemplate(raw.url))
        return null;
    const name = typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim().slice(0, MAX_NAME_LENGTH) : trigger;
    seen.add(trigger);
    return {trigger, name, url: raw.url.trim(), enabled: raw.enabled !== false};
}

/** Return a bounded, deduplicated, validated list of shortcuts. */
export function normalizeQuicklinks(value) {
    const seen = new Set();
    const links = [];
    for (const raw of decode(value)) {
        if (links.length >= MAX_QUICKLINKS)
            break;
        const link = normalizeOne(raw, seen);
        if (link)
            links.push(link);
    }
    return links;
}

export function serializeQuicklinks(links) {
    return JSON.stringify({version: QUICKLINK_VERSION, links: normalizeQuicklinks(links)});
}

/** Build the final URL, percent-encoding the user's query as one component. */
export function buildQuicklinkUrl(link, query) {
    if (!link || !validTemplate(link.url))
        return null;
    const text = typeof query === 'string' ? query.trim() : '';
    if (!text || text.length > MAX_QUERY_LENGTH)
        return null;
    return link.url.replace('{query}', encodeURIComponent(text));
}

/** Match the first token of the query against enabled shortcut triggers. */
export function matchQuicklink(text, links) {
    const input = typeof text === 'string' ? text.trim() : '';
    if (!input)
        return null;
    const separator = input.search(/\s/);
    const trigger = (separator === -1 ? input : input.slice(0, separator)).toLowerCase();
    const query = separator === -1 ? '' : input.slice(separator).trim();
    if (!query)
        return null; // A trigger alone must not hijack ordinary app search.
    const link = normalizeQuicklinks(links).find(item => item.enabled && item.trigger === trigger);
    return link ? {link, query} : null;
}
