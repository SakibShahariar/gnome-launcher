// SPDX-License-Identifier: GPL-2.0-or-later

import {LAYOUT_NAMES} from './layoutNames.js';

const LIMITS = {
    scale: {min: 0.7, max: 1.6},
    opacity: {min: 0.0, max: 1.0},
};

function isValidValue(property, value) {
    const limits = LIMITS[property];
    return Boolean(limits) && typeof value === 'number' &&
        Number.isFinite(value) && value >= limits.min && value <= limits.max;
}

export function parseLayoutAppearanceOverrides(serialized) {
    let parsed;
    try {
        parsed = JSON.parse(serialized || '{}');
    } catch {
        return {};
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        return {};

    const result = {};
    for (const layout of LAYOUT_NAMES) {
        const entry = parsed[layout];
        if (!entry || typeof entry !== 'object' || Array.isArray(entry))
            continue;

        const valid = {};
        for (const property of Object.keys(LIMITS)) {
            if (isValidValue(property, entry[property]))
                valid[property] = entry[property];
        }
        if (Object.keys(valid).length > 0)
            result[layout] = valid;
    }
    return result;
}

export function resolveLayoutAppearance(serialized, layout, defaults) {
    const overrides = parseLayoutAppearanceOverrides(serialized);
    const override = overrides[layout] ?? {};
    return {
        scale: override.scale ?? defaults.scale,
        opacity: override.opacity ?? defaults.opacity,
    };
}

export function setLayoutAppearanceOverride(serialized, layout, property, value) {
    if (!LAYOUT_NAMES.includes(layout))
        throw new Error(`Unknown launcher layout: ${layout}`);
    if (!Object.hasOwn(LIMITS, property))
        throw new Error(`Unknown appearance property: ${property}`);

    const overrides = parseLayoutAppearanceOverrides(serialized);
    if (value === null) {
        if (overrides[layout]) {
            delete overrides[layout][property];
            if (Object.keys(overrides[layout]).length === 0)
                delete overrides[layout];
        }
    } else {
        if (!isValidValue(property, value))
            throw new RangeError(`Invalid ${property} value: ${value}`);
        overrides[layout] ??= {};
        overrides[layout][property] = value;
    }
    return JSON.stringify(overrides);
}
