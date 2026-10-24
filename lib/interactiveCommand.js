// SPDX-License-Identifier: GPL-2.0-or-later

// Commands in this list are terminal-oriented by design. This is deliberately
// a conservative heuristic, not an attempt to infer whether arbitrary
// programs will read from or write to a TTY.
const TERMINAL_COMMANDS = new Set([
    'alsamixer',
    'btop',
    'emacs',
    'gdb',
    'htop',
    'ipython',
    'lazygit',
    'less',
    'lf',
    'man',
    'mc',
    'more',
    'nano',
    'nmtui',
    'nnn',
    'nvim',
    'ranger',
    'screen',
    'tig',
    'tmux',
    'top',
    'vi',
    'vim',
    'watch',
    'yazi',
]);

/** Returns true for common commands that need a terminal for normal use. */
export function requiresTerminal(argv) {
    if (!Array.isArray(argv) || argv.length === 0 ||
        typeof argv[0] !== 'string' || !argv[0].trim())
        return false;

    const executable = argv[0].split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, '');
    return TERMINAL_COMMANDS.has(executable);
}
