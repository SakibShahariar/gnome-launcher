// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const layouts = [
    'adaptiveWidth', 'corner', 'dock', 'fullEdge', 'fullscreen',
    'grid', 'hotkey', 'heroBanner', 'krunner', 'list', 'notch',
    'sidebar', 'splitPreview', 'splitTabs', 'topDropdown',
];

test('all 15 layouts send search-entry changes through the shared query controller', () => {
    for (const name of layouts) {
        const source = readFileSync(new URL(`../lib/layouts/${name}.js`, import.meta.url), 'utf8');
        assert.match(source, /text-changed/, `${name} must observe search-entry changes`);
        assert.match(source, /dialog\.onQueryChanged\(/, `${name} must route search through LauncherDialog`);
    }
});

test('shared query controller parses prefixes before application search', () => {
    const source = readFileSync(new URL('../lib/launcherDialog.js', import.meta.url), 'utf8');
    assert.ok(source.includes('const prefix = parseFinderPrefix(text);'));
    assert.ok(source.includes('await this._searchFinder(prefix.mode, prefix.query);'));
    assert.ok(source.includes('this._renderFinderResults();'));
});
