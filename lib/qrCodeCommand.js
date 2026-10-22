// SPDX-License-Identifier: GPL-2.0-or-later

// Keep user text out of process arguments and shell command strings.
export function qrencodeArguments() {
    return ['qrencode', '-t', 'PNG', '-o', '-'];
}
