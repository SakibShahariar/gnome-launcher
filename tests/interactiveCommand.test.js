// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {requiresTerminal} from '../lib/interactiveCommand.js';

test('recognizes common terminal-oriented editors, pagers, and system monitors', () => {
    for (const command of ['vim', 'nano', 'less', 'htop', 'tmux', 'nmtui']) {
        assert.equal(requiresTerminal([command]), true, command);
    }
});

test('recognizes executable paths and case differences', () => {
    assert.equal(requiresTerminal(['/usr/bin/nvim', 'file.txt']), true);
    assert.equal(requiresTerminal(['C:\\tools\\VIM.EXE']), true);
});

test('does not classify ordinary GUI or non-interactive commands as terminal-only', () => {
    for (const argv of [
        ['firefox'],
        ['code', '--version'],
        ['git', 'status'],
        ['python3', 'script.py'],
    ]) {
        assert.equal(requiresTerminal(argv), false, argv.join(' '));
    }
});

test('handles missing and malformed argv safely', () => {
    assert.equal(requiresTerminal(null), false);
    assert.equal(requiresTerminal([]), false);
    assert.equal(requiresTerminal([null]), false);
    assert.equal(requiresTerminal(['   ']), false);
});
