// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../lib/modes.js', import.meta.url), 'utf8');

test('power actions wait for process completion and notify only on failure', () => {
    assert.ok(source.includes('process.wait_check_async(null, (source, result) =>'));
    assert.ok(source.includes('source.wait_check_finish(result)'));
    assert.ok(source.includes('reportFailure(e)'));
    assert.ok(source.includes("Main.notify('GNOME Launcher', `Could not complete"));
    assert.ok(!source.includes('GLib.spawn_command_line_async(command)'));
});

test('power commands use argument arrays instead of shell command strings', () => {
    const commands = source.slice(source.indexOf('const POWER_COMMANDS'), source.indexOf('export function activatePowerAction'));
    assert.ok(commands.includes("lock: ['loginctl', 'lock-session']"));
    assert.ok(commands.includes("suspend: ['systemctl', 'suspend']"));
    assert.ok(commands.includes("logout: ['gnome-session-quit', '--logout', '--no-prompt']"));
});
