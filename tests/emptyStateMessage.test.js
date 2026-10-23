// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {getModeEmptyMessage} from '../lib/emptyStateMessage.js';

test('provides consistent mode-specific empty copy', () => {
    assert.equal(getModeEmptyMessage('files'), 'Type to search files');
    assert.equal(getModeEmptyMessage('window'), 'No open windows');
    assert.equal(getModeEmptyMessage('settings'), 'No matching Settings panels');
    assert.equal(getModeEmptyMessage('recent'), 'No recent documents');
});

test('explains clipboard history disabled separately from an empty history', () => {
    assert.equal(getModeEmptyMessage('clipboard'), 'Clipboard is empty');
    assert.equal(
        getModeEmptyMessage('clipboard', {clipboardEnabled: false}),
        'Clipboard history is off; enable it in Preferences'
    );
});

test('falls back to the generic empty state for unknown modes', () => {
    assert.equal(getModeEmptyMessage('unknown'), 'No matches');
});
