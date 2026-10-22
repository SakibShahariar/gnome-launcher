// SPDX-License-Identifier: GPL-2.0-or-later

// Keep image support bounded so an unusually large clipboard item cannot
// consume unbounded memory in the Shell process.
export const MAX_CLIPBOARD_IMAGE_BYTES = 8 * 1024 * 1024;

const IMAGE_MIME_PREFERENCE = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/bmp',
];

export function findClipboardImageMime(mimeTypes) {
    if (!Array.isArray(mimeTypes))
        return null;
    return IMAGE_MIME_PREFERENCE.find(mime => mimeTypes.includes(mime)) ?? null;
}

export function canStoreClipboardImage(size) {
    return Number.isSafeInteger(size) && size > 0 && size <= MAX_CLIPBOARD_IMAGE_BYTES;
}
