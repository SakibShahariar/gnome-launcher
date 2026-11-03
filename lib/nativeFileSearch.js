// SPDX-License-Identifier: GPL-2.0-or-later

/** Map GNOME SearchProvider2 identifiers and metadata to local-file candidates. */
export function mapNativeFileResults(identifiers, metadata) {
    const metadataItems = Array.isArray(metadata) ? metadata : [];
    const identifierItems = Array.isArray(identifiers) ? identifiers : [];
    const metadataById = new Map(
        metadataItems
            .filter(item => typeof item?.id === 'string')
            .map(item => [item.id, item])
    );
    const seen = new Set();
    const results = [];

    for (const uri of identifierItems) {
        if (typeof uri !== 'string' || !uri.startsWith('file://') || seen.has(uri))
            continue;
        seen.add(uri);
        const name = metadataById.get(uri)?.name;
        results.push({
            uri,
            name: typeof name === 'string' && name.trim() ? name : null,
        });
    }

    return results;
}
