// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../lib/modes.js', import.meta.url), 'utf8');

test('power actions wait for process completion and notify only on failure', () => {
    assert.match(source, /process\\.wait_check_async\\(null, \\(source, result\\) =>/);
    assert.match(source, /source\\.wait_check_finish\\(result\\)/);
    assert.match(source, /reportFailure\\(e\\)/);
    assert.match(source, /Main\\.notify\\('GNOME Launcher', \\`Could not complete/);
    assert.doesNotMatch(source, /GLib\\.spawn_command_line_async\\(command\\)/);
});

test('power commands use argument arrays instead of shell command strings', () => {
    const commands = source.slice(source.indexOf('const POWER_COMMANDS'), source.indexOf('export function activatePowerAction'));
    assert.match(commands, /lock: \\['loginctl', 'lock-session'\\]/);
    assert.match(commands, /suspend: \\['systemctl', 'suspend'\\]/);
    assert.match(commands, /logout: \\['gnome-session-quit', '--logout', '--no-prompt'\\]/);
});
