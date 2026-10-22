// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {buildSearchUrl} from '../lib/webSearch.js';

test('encodes web queries in the configured URL template', () => {
    assert.equal(
        buildSearchUrl('cats & dogs'),
        'https://www.google.com/search?q=cats%20%26%20dogs'
    );
    assert.equal(
        buildSearchUrl('gnome launcher', 'https://duckduckgo.com/?q={query}&ia=web'),
        'https://duckduckgo.com/?q=gnome%20launcher&ia=web'
    );
});

test('rejects empty queries and unsafe or malformed templates', () => {
    assert.equal(buildSearchUrl('  '), null);
    assert.equal(buildSearchUrl('query', 'file:///tmp/{query}'), null);
    assert.equal(buildSearchUrl('query', 'javascript:alert({query})'), null);
    assert.equal(buildSearchUrl('query', 'https://example.com/search'), null);
    assert.equal(buildSearchUrl('query', 'https://example.com/{query}'), 'https://example.com/query');
    assert.equal(buildSearchUrl(null), null);
});
