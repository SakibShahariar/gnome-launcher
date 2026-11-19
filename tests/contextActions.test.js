// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getContextActions, filePathFromItem} from '../lib/contextActions.js';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('file results expose only supported local actions', () => {
    assert.deepEqual(getContextActions({kind: 'file', path: '/home/user/a.txt'}).map(a => a.id),
        ['copy-path', 'open-folder']);
    assert.deepEqual(getContextActions({kind: 'file', uri: 'file:///home/user/a%20b.txt'}).map(a => a.id),
        ['copy-path', 'open-folder']);
    assert.deepEqual(getContextActions({kind: 'file', uri: 'https://example.com/a'}), []);
    assert.deepEqual(getContextActions({kind: 'web', query: 'x'}), []);
    assert.deepEqual(getContextActions(null), []);
});

test('file paths are decoded only for local file URIs', () => {
    assert.equal(filePathFromItem({kind: 'file', path: '/tmp/x'}), '/tmp/x');
    assert.equal(filePathFromItem({kind: 'file', uri: 'file:///tmp/a%20b'}), '/tmp/a b');
    assert.equal(filePathFromItem({kind: 'file', uri: 'http://x/y'}), null);
});

test('shared menu dispatches finder results and reuses the app menu', () => {
    const dialog = read('../lib/launcherDialog.js');
    assert.match(dialog, /if \(this\._finderMode\)\s*return this\._openFinderContextActions\(index\);/);
    assert.match(dialog, /getContextActions\(item\)/);
    assert.match(dialog, /_activateFileAction\(action\.id, path\)/);
    assert.match(dialog, /St\.Clipboard\.get_default\(\)\?\.set_text\(St\.ClipboardType\.CLIPBOARD, path\)/);
    assert.match(dialog, /Gio\.AppInfo\.launch_default_for_uri\(parent\.get_uri\(\), null\)/);
    assert.match(dialog, /Boolean\(this\._finderMode\) \|\| !this\._layout\.mode/);
    assert.match(dialog, /event\.get_button\(\) === Clutter\.BUTTON_SECONDARY[\s\S]*?this\.openAppActions\(index\)/);
});
