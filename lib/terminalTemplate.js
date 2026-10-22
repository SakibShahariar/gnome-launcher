// SPDX-License-Identifier: GPL-2.0-or-later

const COMMAND_PLACEHOLDER = '{command}';

/** A terminal template must contain one standalone command placeholder. */
export function isValidTerminalTemplateArgs(argv) {
    return Array.isArray(argv) &&
        argv.length > 1 &&
        typeof argv[0] === 'string' &&
        argv[0].length > 0 &&
        argv[0] !== COMMAND_PLACEHOLDER &&
        argv.filter(arg => arg === COMMAND_PLACEHOLDER).length === 1;
}

/** Expand a validated template without concatenating user input into a shell string. */
export function expandTerminalTemplateArgs(templateArgv, commandArgv) {
    if (!isValidTerminalTemplateArgs(templateArgv) ||
        !Array.isArray(commandArgv) || commandArgv.length === 0)
        return null;

    const placeholderIndex = templateArgv.indexOf(COMMAND_PLACEHOLDER);
    return [
        ...templateArgv.slice(0, placeholderIndex),
        ...commandArgv,
        ...templateArgv.slice(placeholderIndex + 1),
    ];
}
