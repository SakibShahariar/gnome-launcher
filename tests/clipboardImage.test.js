import test from 'node:test';
import assert from 'node:assert/strict';

import {
    canStoreClipboardImage,
    findClipboardImageMime,
    MAX_CLIPBOARD_IMAGE_BYTES,
} from '../lib/clipboardImage.js';

test('prefers common clipboard image MIME types deterministically', () => {
    assert.equal(findClipboardImageMime(['text/plain', 'image/jpeg', 'image/png']), 'image/png');
    assert.equal(findClipboardImageMime(['image/webp', 'image/gif']), 'image/webp');
});

test('ignores unsupported and malformed MIME type lists', () => {
    assert.equal(findClipboardImageMime(['text/plain', 'application/octet-stream']), null);
    assert.equal(findClipboardImageMime(null), null);
    assert.equal(findClipboardImageMime('image/png'), null);
});

test('bounds retained clipboard image sizes', () => {
    assert.equal(canStoreClipboardImage(1), true);
    assert.equal(canStoreClipboardImage(MAX_CLIPBOARD_IMAGE_BYTES), true);
    assert.equal(canStoreClipboardImage(0), false);
    assert.equal(canStoreClipboardImage(MAX_CLIPBOARD_IMAGE_BYTES + 1), false);
    assert.equal(canStoreClipboardImage(Number.NaN), false);
});
