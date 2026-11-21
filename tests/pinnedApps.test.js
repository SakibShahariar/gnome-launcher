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

test('only matching pins are promoted during a search', () => {
    const terminal = {get_id: () => 'org.gnome.Terminal.desktop', get_name: () => 'Terminal'};
    const files = {get_id: () => 'org.gnome.Nautilus.desktop', get_name: () => 'Files'};
    const browser = {get_id: () => 'org.mozilla.firefox.desktop', get_name: () => 'Firefox'};
    const pins = ['org.gnome.Terminal.desktop', 'org.gnome.Nautilus.desktop'];

    // "firefox" promotes no pin, so the ranked match stays first.
    assert.deepEqual(
        orderAppsWithPinnedFirst([terminal, files, browser], pins,
            [browser, files, terminal], 'firefox'),
        [browser, files, terminal]
    );

    // A matching pin still comes first and is not duplicated.
    assert.deepEqual(
        orderAppsWithPinnedFirst([terminal, files, browser], pins,
            [browser, files, terminal], 'files'),
        [files, browser, terminal]
    );

    // Empty query keeps the original all-pins-first behavior.
    assert.deepEqual(
        orderAppsWithPinnedFirst([terminal, files, browser], pins, [browser, files, terminal]),
        [terminal, files, browser]
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
