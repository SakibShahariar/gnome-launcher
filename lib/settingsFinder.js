// SPDX-License-Identifier: GPL-2.0-or-later

// Common GNOME Control Center panels. Keep the search data independent of
// GObject so it can be tested with Node without a running GNOME session.
export const SETTINGS_PANELS = Object.freeze([
    {id: 'network', name: 'Network', keywords: ['internet', 'connection', 'ethernet']},
    {id: 'wifi', name: 'Wi-Fi', keywords: ['wireless', 'network']},
    {id: 'display', name: 'Displays', keywords: ['monitor', 'resolution', 'screen']},
    {id: 'sound', name: 'Sound', keywords: ['audio', 'volume', 'microphone', 'speaker']},
    {id: 'bluetooth', name: 'Bluetooth', keywords: ['wireless', 'pairing']},
    {id: 'power', name: 'Power', keywords: ['battery', 'suspend', 'energy']},
    {id: 'applications', name: 'Apps', keywords: ['default apps', 'permissions']},
    {id: 'keyboard', name: 'Keyboard', keywords: ['shortcuts', 'typing', 'input']},
    {id: 'mouse', name: 'Mouse and Touchpad', keywords: ['pointer', 'touchpad', 'trackpad']},
    {id: 'printers', name: 'Printers', keywords: ['printing']},
    {id: 'privacy', name: 'Privacy', keywords: ['screen lock', 'location', 'camera']},
    {id: 'user-accounts', name: 'Users', keywords: ['account', 'password']},
    {id: 'region', name: 'Region and Language', keywords: ['language', 'keyboard layout', 'formats']},
    {id: 'online-accounts', name: 'Online Accounts', keywords: ['google', 'cloud']},
    {id: 'background', name: 'Background', keywords: ['wallpaper']},
    {id: 'universal-access', name: 'Accessibility', keywords: ['vision', 'hearing', 'assistive technology']},
]);

/** Returns a fresh list of matching GNOME Settings panels. */
export function searchSettingsPanels(query = '') {
    const normalized = typeof query === 'string' ? query.trim().toLowerCase() : '';
    if (!normalized)
        return SETTINGS_PANELS.map(panel => ({...panel, keywords: [...panel.keywords], kind: 'settings'}));

    return SETTINGS_PANELS
        .filter(panel => [panel.name, panel.id, ...panel.keywords]
            .some(value => value.toLowerCase().includes(normalized)))
        .map(panel => ({...panel, keywords: [...panel.keywords], kind: 'settings'}));
}
