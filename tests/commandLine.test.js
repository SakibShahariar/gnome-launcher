// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {parseCommandLine} from '../lib/commandLine.js';

test('trims the command and returns parsed argv without shell execution', () => {
    let received;
    const result = parseCommandLine('  echo "hello world"  ', line => {
        received = line;
        return [true, ['echo', 'hello world']];
    });

    assert.equal(received, 'echo "hello world"');
    assert.deepEqual(result, {argv: ['echo', 'hello world'], error: null});
});

test('preserves shell metacharacters as ordinary parsed arguments', () => {
    const result = parseCommandLine('echo hello; touch /tmp/pwned', line => [
        true, ['echo', 'hello;', 'touch', '/tmp/pwned'],
    ]);

    assert.deepEqual(result.argv, ['echo', 'hello;', 'touch', '/tmp/pwned']);
});

test('returns no argv for empty input or unsuccessful parsing', () => {
    const parser = () => [false, []];
    assert.deepEqual(parseCommandLine('   ', parser), {argv: null, error: null});
    assert.deepEqual(parseCommandLine('not valid', parser), {argv: null, error: null});
    assert.deepEqual(parseCommandLine('empty', () => [true, []]), {argv: null, error: null});
});

test('returns parser errors for invalid quoting', () => {
    const error = new Error('Unmatched quote');
    const result = parseCommandLine("echo 'unfinished", () => {
        throw error;
    });

    assert.equal(result.argv, null);
    assert.equal(result.error, error);
});
