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

function executableName(value) {
    if (typeof value !== 'string' || !value.trim())
        return '';
    return value.split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, '');
}

// Unwrap only common, unambiguous command wrappers. Unknown options fail
// closed: this helper should avoid claiming it understands arbitrary argv.
function unwrapCommand(argv) {
    let index = 0;
    for (let depth = 0; depth < 4; depth++) {
        const name = executableName(argv[index]);
        if (name === 'command') {
            index++;
            if (argv[index] === '-p')
                index++;
            if (argv[index] === '--')
                index++;
            continue;
        }

        if (name === 'sudo' || name === 'doas') {
            index++;
            let valid = true;
            while (index < argv.length) {
                const arg = argv[index];
                if (arg === '--') {
                    index++;
                    break;
                }
                if (arg === '-u' || arg === '--user') {
                    if (index + 1 >= argv.length)
                        return '';
                    index += 2;
                    continue;
                }
                if (arg.startsWith('--user=')) {
                    index++;
                    continue;
                }
                if (name === 'sudo' &&
                    ['-E', '-H', '-n', '-S', '-b', '-P', '--preserve-env',
                        '--set-home', '--non-interactive', '--stdin'].includes(arg)) {
                    index++;
                    continue;
                }
                if (name === 'doas' && arg === '-s') {
                    index++;
                    continue;
                }
                if (arg.startsWith('-'))
                    valid = false;
                break;
            }
            if (!valid)
                return '';
            continue;
        }

        if (name === 'env') {
            index++;
            while (index < argv.length) {
                const arg = argv[index];
                if (arg === '--') {
                    index++;
                    break;
                }
                if (arg === '-i' || arg === '--ignore-environment' || arg === '-0') {
                    index++;
                    continue;
                }
                if (arg === '-u' || arg === '--unset' || arg === '-C' || arg === '--chdir') {
                    if (index + 1 >= argv.length)
                        return '';
                    index += 2;
                    continue;
                }
                if (arg.startsWith('--unset=') || arg.startsWith('--chdir=')) {
                    index++;
                    continue;
                }
                if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(arg)) {
                    index++;
                    continue;
                }
                if (arg.startsWith('-'))
                    return '';
                break;
            }
            continue;
        }

        return name;
    }
    return '';
}

/** Returns true for common commands that need a terminal for normal use. */
export function requiresTerminal(argv) {
    if (!Array.isArray(argv) || argv.length === 0 ||
        argv.some(arg => typeof arg !== 'string'))
        return false;

    const executable = unwrapCommand(argv);
    return TERMINAL_COMMANDS.has(executable);
}
