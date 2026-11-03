// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    normalizePinnedAppIds,
    togglePinnedAppId,
    getPinnedApps,
    orderAppsWithPinnedFirst,
} from '../lib/pinnedApps.js';

const app = id => ({get_id: () => id, get_name: () => id});

test('normalizes persisted IDs without changing their first-seen order', () => {
    assert.deepEqual(
        normalizePinnedAppIds(['org.gnome.Terminal.desktop', '', 'org.gnome.Terminal.desktop', null, 'org.gnome.Files.desktop']),
        ['org.gnome.Terminal.desktop', 'org.gnome.Files.desktop']
    );
});

test('pinning appends and unpinning removes only the selected ID', () => {
    const initial = ['org.gnome.Terminal.desktop', 'org.gnome.Files.desktop'];
    assert.deepEqual(
        togglePinnedAppId(initial, 'org.gnome.Software.desktop'),
        [...initial, 'org.gnome.Software.desktop']
    );
    assert.deepEqual(
        togglePinnedAppId(initial, 'org.gnome.Terminal.desktop'),
        ['org.gnome.Files.desktop']
    );
    assert.deepEqual(initial, ['org.gnome.Terminal.desktop', 'org.gnome.Files.desktop']);
});

test('resolves favorites in saved order and ignores apps no longer installed', () => {
    const terminal = app('org.gnome.Terminal.desktop');
    const files = app('org.gnome.Nautilus.desktop');
    const software = app('org.gnome.Software.desktop');

    assert.deepEqual(
        getPinnedApps([terminal, files, software], [
            'org.gnome.Software.desktop',
            'org.gnome.Missing.desktop',
            'org.gnome.Terminal.desktop',
        ]),
        [software, terminal]
    );
});

test('puts pins before search results and suppresses duplicate matches', () => {
    const terminal = app('org.gnome.Terminal.desktop');
    const files = app('org.gnome.Nautilus.desktop');
    const software = app('org.gnome.Software.desktop');
    const browser = app('org.mozilla.firefox.desktop');

    assert.deepEqual(
        orderAppsWithPinnedFirst(
            [terminal, files, software, browser],
            ['org.gnome.Software.desktop', 'org.gnome.Terminal.desktop'],
            [browser, terminal, files]
        ),
        [software, terminal, browser, files]
    );
});

test('keeps search-provider ranking unchanged when no apps are pinned', () => {
    const ranked = [app('firefox.desktop'), app('terminal.desktop'), app('files.desktop')];
    assert.deepEqual(orderAppsWithPinnedFirst([...ranked], [], ranked), ranked);
});

test('ignores stale pin IDs without deleting them from the persisted list', () => {
    const ids = ['missing.desktop', 'terminal.desktop'];
    const ordered = orderAppsWithPinnedFirst([app('terminal.desktop')], ids, []);
    assert.deepEqual(ordered.map(item => item.get_id()), ['terminal.desktop']);
    assert.deepEqual(ids, ['missing.desktop', 'terminal.desktop']);
});
