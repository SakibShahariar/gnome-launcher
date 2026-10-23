// SPDX-License-Identifier: GPL-2.0-or-later

/**
 * Parse a command line with the caller's shell-like argv parser without
 * executing shell syntax. The injected parser keeps this helper testable
 * outside GNOME Shell.
 */
export function parseCommandLine(commandLine, parseArgv) {
    if (typeof commandLine !== 'string' || !commandLine.trim())
        return {argv: null, error: null};

    try {
        const [success, argv] = parseArgv(commandLine.trim());
        if (!success || !Array.isArray(argv) || argv.length === 0)
            return {argv: null, error: null};
        return {argv, error: null};
    } catch (error) {
        return {argv: null, error};
    }
}
