// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('preferences keep the large layout gallery on a dedicated page', () => {
    const source = readFileSync(new URL('../prefs.js', import.meta.url), 'utf8');
    assert.match(source, /const layoutsPage = new Adw\.PreferencesPage\(\{[\s\S]*title: 'Layouts'/);
    assert.match(source, /layoutsPage\.add\(layoutGroup\)/);
    assert.match(source, /layoutsPage\.add\(galleryGroup\)/);
    assert.match(source, /window\.add\(generalPage\);\s*window\.add\(layoutsPage\);/);
    assert.match(source, /layoutRow\.add_css_class\('launcher-layout-selector'\)/);
    assert.match(source, /\.launcher-layout-selector button[\s\S]*min-width: 16rem/);
});
