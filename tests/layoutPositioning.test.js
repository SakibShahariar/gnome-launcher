// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const layoutPositions = {
    corner: 'top-left',
    dock: 'bottom',
    fullEdge: 'left-edge',
    fullscreen: 'fullscreen',
    krunner: 'top-flush',
    notch: 'top-flush',
    topDropdown: 'top-flush',
};

const dialogSource = readFileSync(new URL('../lib/launcherDialog.js', import.meta.url), 'utf8');
const positionStart = dialogSource.indexOf('    _applyPosition() {');
const positionEnd = dialogSource.indexOf('    // Cancel work', positionStart);
const positionSource = dialogSource.slice(positionStart, positionEnd);

test('every non-centered layout uses a position handled by the shared modal anchor', () => {
    for (const [layout, position] of Object.entries(layoutPositions)) {
        const source = readFileSync(new URL(`../lib/layouts/${layout}.js`, import.meta.url), 'utf8');
        assert.ok(source.includes(`this.position = '${position}'`), `${layout} declares ${position}`);
        assert.ok(positionSource.includes(`case '${position}':`), `${position} is handled by LauncherDialog`);
    }
});

test('modal anchor is resolved before the first layout render', () => {
    const resolveAnchor = dialogSource.indexOf('this._modalBox = this.contentLayout.get_parent();');
    const firstRender = dialogSource.indexOf('this._rerender();', resolveAnchor);
    assert.ok(resolveAnchor >= 0);
    assert.ok(firstRender > resolveAnchor);
});

test('positioning remains declarative across relayouts', () => {
    assert.ok(positionSource.includes('this._modalBox.set({'));
    for (const property of ['x_align', 'y_align', 'x_expand', 'y_expand'])
        assert.ok(positionSource.includes(`${property}:`), `missing ${property}`);
    assert.ok(positionSource.includes('margin-top:'));
    assert.ok(positionSource.includes('margin-bottom:'));
    assert.ok(positionSource.includes('margin-left:'));
    assert.ok(positionSource.includes('margin-right:'));
    assert.ok(!/\.\s*set_position\s*\(/.test(positionSource));
});
