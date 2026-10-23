// SPDX-License-Identifier: GPL-2.0-or-later

import {createFinderRegistry} from './finderRegistry.js';

// Shared finder metadata. Keeping definitions separate from the layouts
// lets Spotlight add finders without growing another set of prefix checks.
export const FINDERS = createFinderRegistry([
    {mode: 'apps', default: true, label: 'Applications'},
    {mode: 'run', prefix: '>', label: 'Run a command'},
    {mode: 'files', prefix: '/', label: 'Search files'},
    {mode: 'clipboard', prefix: ';', label: 'Clipboard history'},
    {mode: 'calculator', prefix: '=', label: 'Calculate'},
    {mode: 'web', prefix: '?', label: 'Search the web'},
    {mode: 'emoji', keyword: 'emoji', caseInsensitive: true, label: 'Search emoji'},
    {mode: 'recent', keyword: 'recent', caseInsensitive: true, label: 'Recent documents'},
    {mode: 'window', prefix: 'w ', caseInsensitive: true, label: 'Switch windows'},
    {mode: 'settings', prefix: 's ', caseInsensitive: true, keyword: 'settings', label: 'GNOME Settings'},
]);

export function parseFinderPrefix(input) {
    return FINDERS.parsePrefix(input);
}
