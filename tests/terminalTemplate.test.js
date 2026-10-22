// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    expandTerminalTemplateArgs,
    isValidTerminalTemplateArgs,
} from '../lib/terminalTemplate.js';

test('accepts one standalone command placeholder after the terminal executable', () => {
    assert.equal(isValidTerminalTemplateArgs(['ptyxis', '--', '{command}']), true);
    assert.equal(isValidTerminalTemplateArgs(['konsole', '-e', '{command}']), true);
});

test('rejects missing, repeated, embedded, or executable placeholders', () => {
    for (const argv of [
        [], ['ptyxis'], ['ptyxis', '-e', '{command}', '{command}'],
        ['ptyxis', '-e', 'prefix-{command}'], ['{command}', '--'],
    ])
        assert.equal(isValidTerminalTemplateArgs(argv), false, JSON.stringify(argv));
});

test('expands command arguments as argv entries without shell concatenation', () => {
    assert.deepEqual(
        expandTerminalTemplateArgs(['ptyxis', '--', '{command}'], ['printf', '%s', 'hello world']),
        ['ptyxis', '--', 'printf', '%s', 'hello world']
    );
    assert.equal(expandTerminalTemplateArgs(['ptyxis'], ['echo', 'x']), null);
});
