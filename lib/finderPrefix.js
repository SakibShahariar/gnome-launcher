// SPDX-License-Identifier: GPL-2.0-or-later

// Prefixes shared by layouts that expose finder modes. Keep this module
// free of GNOME imports so parsing can be tested with Node's test runner.
const PREFIXES = [
    {prefix: '>', mode: 'run'},
    {prefix: '/', mode: 'files'},
    {prefix: ';', mode: 'clipboard'},
    {prefix: '=', mode: 'calculator'},
    {prefix: '?', mode: 'web'},
];

export function parseFinderPrefix(input) {
    if (typeof input !== 'string')
        return null;

    for (const {prefix, mode} of PREFIXES) {
        if (input.startsWith(prefix))
            return {mode, query: input.slice(prefix.length).trimStart()};
    }

    if (/^emoji(?:\\s|$)/i.test(input))
        return {mode: 'emoji', query: input.slice(5).trimStart()};

    if (/^recent(?:\s|$)/i.test(input))
        return {mode: 'recent', query: input.slice(6).trimStart()};

    if (/^w\s/i.test(input))
        return {mode: 'window', query: input.slice(1).trimStart()};

    return null;
}
