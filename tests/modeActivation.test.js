// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {activateModeResult} from '../lib/modeActivation.js';

function actions() {
    const calls = [];
    return {
        calls,
        openFile: value => calls.push(['openFile', value]),
        restoreClipboard: value => calls.push(['restoreClipboard', value]),
        copyText: value => calls.push(['copyText', value]),
        openWebSearch: value => { calls.push(['openWebSearch', value]); return true; },
        openRecentFile: value => { calls.push(['openRecentFile', value]); return true; },
        activateWindow: value => calls.push(['activateWindow', value]),
        openSettingsPanel: value => { calls.push(['openSettingsPanel', value]); return true; },
        close: () => calls.push(['close']),
    };
}

test('activates and closes for file, clipboard, emoji, and window results', () => {
    const image = {kind: 'clipboard-image', uri: 'image'};
    for (const [item, expected] of [
        [{kind: 'file', path: '/tmp/a'}, ['openFile', '/tmp/a']],
        [image, ['restoreClipboard', image]],
        [{kind: 'emoji', emoji: '🙂'}, ['copyText', '🙂']],
        [{kind: 'window', window: 42}, ['activateWindow', 42]],
    ]) {
        const handler = actions();
        assert.equal(activateModeResult(item, handler), true);
        assert.deepEqual(handler.calls.slice(0, 1), [expected]);
        assert.deepEqual(handler.calls.at(-1), ['close']);
    }
});

test('does not close when calculator input is not copyable or an opener fails', () => {
    const handler = actions();
    assert.equal(activateModeResult({kind: 'calculator', value: null, copyable: false}, handler), false);
    handler.openWebSearch = () => false;
    assert.equal(activateModeResult({kind: 'web', query: 'x'}, handler), false);
    handler.openRecentFile = () => false;
    assert.equal(activateModeResult({kind: 'recent', uri: 'file:///missing'}, handler), false);
    handler.openSettingsPanel = () => false;
    assert.equal(activateModeResult({kind: 'settings', id: 'missing'}, handler), false);
    assert.deepEqual(handler.calls, []);
});

test('copies calculator results and handles absent items safely', () => {
    const handler = actions();
    assert.equal(activateModeResult(null, handler), false);
    assert.equal(activateModeResult({kind: 'calculator', value: '4', copyable: true}, handler), true);
    assert.deepEqual(handler.calls, [['copyText', '4'], ['close']]);
});
