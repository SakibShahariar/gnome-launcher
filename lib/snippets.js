// SPDX-License-Identifier: GPL-2.0-or-later

// Reusable, user-authored text snippets. Pure module so storage validation,
// filtering and serialization are testable without GNOME Shell. Snippets are
// local only: no network, no automatic clipboard capture.

export const SNIPPET_VERSION = 1;
export const MAX_SNIPPETS = 50;
const MAX_TITLE = 60;
const MAX_TRIGGER = 24;
const MAX_CONTENT = 8000;
const TRIGGER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,23}$/;

function decode(value) {
    if (Array.isArray(value))
        return value;
    if (typeof value !== 'string' || !value.trim())
        return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed))
            return parsed;
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.snippets))
            return parsed.snippets;
    } catch {
        // Malformed settings are treated as an empty list.
    }
    return [];
}

function slug(title, trigger) {
    if (trigger)
        return trigger;
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return base || 'snippet';
}

function normalizeOne(raw, usedIds, usedTriggers) {
    if (!raw || typeof raw !== 'object')
        return null;
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, MAX_TITLE) : '';
    const content = typeof raw.content === 'string' ? raw.content : '';
    if (!title || !content.trim() || content.length > MAX_CONTENT)
        return null;

    let trigger = typeof raw.trigger === 'string' ? raw.trigger.trim().toLowerCase() : '';
    if (trigger && (trigger.length > MAX_TRIGGER || !TRIGGER_PATTERN.test(trigger)))
        return null;
    if (trigger && usedTriggers.has(trigger))
        return null;

    let id = slug(title, trigger);
    if (usedIds.has(id))
        return null;
    usedIds.add(id);
    if (trigger)
        usedTriggers.add(trigger);

    return {id, title, trigger, content, enabled: raw.enabled !== false};
}

/** Return a bounded, deduplicated, validated list of snippets. */
export function normalizeSnippets(value) {
    const usedIds = new Set();
    const usedTriggers = new Set();
    const snippets = [];
    for (const raw of decode(value)) {
        if (snippets.length >= MAX_SNIPPETS)
            break;
        const snippet = normalizeOne(raw, usedIds, usedTriggers);
        if (snippet)
            snippets.push(snippet);
    }
    return snippets;
}

export function serializeSnippets(snippets) {
    return JSON.stringify({version: SNIPPET_VERSION, snippets: normalizeSnippets(snippets)});
}

/** Filter by title, trigger, and content, case-insensitively. */
export function searchSnippets(query, snippets) {
    const text = typeof query === 'string' ? query.trim().toLowerCase() : '';
    return normalizeSnippets(snippets)
        .filter(snippet => snippet.enabled !== false)
        .filter(snippet => !text ||
            snippet.title.toLowerCase().includes(text) ||
            (snippet.trigger && snippet.trigger.includes(text)) ||
            snippet.content.toLowerCase().includes(text))
        .slice(0, MAX_SNIPPETS);
}
