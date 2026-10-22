// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {parsePrefix} from '../lib/spotlightPrefix.js';

test('unprefixed and empty queries use the apps finder unchanged', () => {
    assert.deepEqual(parsePrefix(''), {finder: 'apps', query: '', prefixed: false});
    assert.deepEqual(parsePrefix('  firefox  '), {
        finder: 'apps', query: '  firefox  ', prefixed: false,
    });
});

test('symbol prefixes select their finder and strip only the prefix', () => {
    assert.deepEqual(parsePrefix('= 2 + 2'), {
        finder: 'calculator', query: '2 + 2', prefixed: true,
    });
    assert.deepEqual(parsePrefix('/ Downloads'), {
        finder: 'files', query: 'Downloads', prefixed: true,
    });
    assert.deepEqual(parsePrefix('; copied text'), {
        finder: 'clipboard', query: 'copied text', prefixed: true,
    });
    assert.deepEqual(parsePrefix(': copied text'), {
        finder: 'clipboard', query: 'copied text', prefixed: true,
    });
    assert.deepEqual(parsePrefix('> top'), {
        finder: 'run', query: 'top', prefixed: true,
    });
    assert.deepEqual(parsePrefix('? cats'), {
        finder: 'web', query: 'cats', prefixed: true,
    });
});

test('word prefixes are case-insensitive and require their separating space', () => {
    assert.deepEqual(parsePrefix('RUN printf hello'), {
        finder: 'run', query: 'printf hello', prefixed: true,
    });
    assert.deepEqual(parsePrefix('W Firefox'), {
        finder: 'windows', query: 'Firefox', prefixed: true,
    });
    assert.deepEqual(parsePrefix('Windows Terminal'), {
        finder: 'windows', query: 'Terminal', prefixed: true,
    });
    assert.deepEqual(parsePrefix('runner'), {
        finder: 'apps', query: 'runner', prefixed: false,
    });
});

test('unknown leading symbols fall back to the apps finder', () => {
    assert.deepEqual(parsePrefix('@mail'), {
        finder: 'apps', query: '@mail', prefixed: false,
    });
});

test('non-string inputs safely become an empty apps query', () => {
    assert.deepEqual(parsePrefix(null), {finder: 'apps', query: '', prefixed: false});
});
