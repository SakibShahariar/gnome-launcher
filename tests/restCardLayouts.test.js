// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const variants = {
    adaptiveWidth: 'compact',
    corner: 'compact',
    dock: 'compact',
    fullEdge: 'compact',
    fullscreen: 'full',
    grid: 'compact',
    hotkey: 'compact',
    heroBanner: 'full',
    krunner: 'full',
    list: 'full',
    notch: 'compact',
    sidebar: 'full',
    splitPreview: 'compact',
    splitTabs: 'full',
    topDropdown: 'full',
};

test('all 15 layouts show a rest card for an empty application query', () => {
    for (const [name, variant] of Object.entries(variants)) {
        const source = readFileSync(new URL(`../lib/layouts/${name}.js`, import.meta.url), 'utf8');
        assert.ok(source.includes("import {makeRestCard} from '../restCard.js';"), `${name} imports the shared rest card`);
        assert.ok(source.includes('if (!this.entry.get_text().trim())'), `${name} handles an empty query`);
        assert.ok(source.includes(`variant: '${variant}'`), `${name} uses the ${variant} rest-card variant`);
    }
});

test('rest-card hints list every registered finder prefix', () => {
    const source = readFileSync(new URL('../lib/restCard.js', import.meta.url), 'utf8');
    for (const hint of ['> run', '/ files', '; clipboard', '! power', '= calculate', '? web', 'w windows', 'recent', 'emoji', 's settings'])
        assert.ok(source.includes(hint), `missing finder hint: ${hint}`);
    assert.ok(source.includes('showRecentApps && !compact'));
    assert.ok(source.includes('label.clutter_text.set_line_wrap(true)'));
});

test('Hotkey rest card preserves the Ctrl+1–9 launch hint without taking digit keys', () => {
    const source = readFileSync(new URL('../lib/layouts/hotkey.js', import.meta.url), 'utf8');
    assert.ok(source.includes('Ctrl+1–9 to launch'));
    assert.ok(source.includes("variant: 'compact'"));
    assert.ok(source.includes('onDigitKey(localIndex)'));
    assert.ok(source.includes('if (!this.entry.get_text().trim())'));

});
