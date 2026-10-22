// SPDX-License-Identifier: GPL-2.0-or-later

// Small arithmetic parser. Never use eval() or execute user input as code.
export function evaluateExpression(input) {
    if (typeof input !== 'string' || input.length === 0 || input.length > 256)
        return null;

    const source = input.replace(/\s+/g, '');
    if (!source)
        return null;

    let position = 0;
    let tokenCount = 0;

    function peek() {
        return source[position] ?? '';
    }

    function consume() {
        tokenCount++;
        if (tokenCount > 128)
            throw new Error('Expression is too complex');
        return source[position++];
    }

    function parsePrimary() {
        if (peek() === '(') {
            consume();
            const value = parseAdditive();
            if (consume() !== ')')
                throw new Error('Missing closing parenthesis');
            return value;
        }

        const match = source.slice(position).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
        if (!match)
            throw new Error('Expected a number');
        position += match[0].length;
        tokenCount++;
        if (tokenCount > 128)
            throw new Error('Expression is too complex');
        const value = Number(match[0]);
        if (!Number.isFinite(value))
            throw new Error('Number out of range');
        return value;
    }

    function parseUnary() {
        if (peek() === '+') {
            consume();
            return parseUnary();
        }
        if (peek() === '-') {
            consume();
            return -parseUnary();
        }
        return parsePower();
    }

    function parsePower() {
        const left = parsePrimary();
        if (peek() === '^') {
            consume();
            return left ** parseUnary();
        }
        return left;
    }

    function parseMultiplicative() {
        let value = parseUnary();
        while (['*', '/', '%'].includes(peek())) {
            const operator = consume();
            const right = parseUnary();
            if ((operator === '/' || operator === '%') && right === 0)
                throw new Error('Division by zero');
            value = operator === '*' ? value * right
                : operator === '/' ? value / right
                : value % right;
            if (!Number.isFinite(value))
                throw new Error('Result out of range');
        }
        return value;
    }

    function parseAdditive() {
        let value = parseMultiplicative();
        while (peek() === '+' || peek() === '-') {
            const operator = consume();
            const right = parseMultiplicative();
            value = operator === '+' ? value + right : value - right;
            if (!Number.isFinite(value))
                throw new Error('Result out of range');
        }
        return value;
    }

    try {
        const result = parseAdditive();
        if (position !== source.length || !Number.isFinite(result))
            return null;
        return Object.is(result, -0) ? 0 : result;
    } catch {
        return null;
    }
}

export function formatExpressionResult(value) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        return null;
    return Number(value.toPrecision(12)).toString();
}

const UNIT_TABLE = {
    length: {m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, ft: 0.3048, in: 0.0254, yd: 0.9144},
    mass: {kg: 1, g: 0.001, mg: 0.000001, lb: 0.45359237, oz: 0.028349523125},
    volume: {l: 1, ml: 0.001, gal: 3.785411784, cup: 0.2365882365},
    time: {s: 1, sec: 1, min: 60, h: 3600, hr: 3600, day: 86400},
};

const UNIT_ALIASES = {
    meter: 'm', meters: 'm', metre: 'm', metres: 'm',
    kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km',
    centimeter: 'cm', centimeters: 'cm', millimeter: 'mm', millimeters: 'mm',
    mile: 'mi', miles: 'mi', foot: 'ft', feet: 'ft', inch: 'in', inches: 'in', yard: 'yd', yards: 'yd',
    kilogram: 'kg', kilograms: 'kg', gram: 'g', grams: 'g', milligram: 'mg', milligrams: 'mg',
    pound: 'lb', pounds: 'lb', ounce: 'oz', ounces: 'oz',
    liter: 'l', liters: 'l', litre: 'l', litres: 'l', milliliter: 'ml', milliliters: 'ml',
    gallon: 'gal', gallons: 'gal', cups: 'cup',
    second: 's', seconds: 's', minute: 'min', minutes: 'min', hour: 'h', hours: 'h', days: 'day',
};

function normalizeUnit(unit) {
    const normalized = unit.toLowerCase();
    if (['c', '°c', 'celsius'].includes(normalized))
        return {family: 'temperature', unit: 'c'};
    if (['f', '°f', 'fahrenheit'].includes(normalized))
        return {family: 'temperature', unit: 'f'};
    if (['k', 'kelvin'].includes(normalized))
        return {family: 'temperature', unit: 'k'};

    const alias = UNIT_ALIASES[normalized] ?? normalized;
    for (const [family, units] of Object.entries(UNIT_TABLE)) {
        if (Object.hasOwn(units, alias))
            return {family, unit: alias};
    }
    return null;
}

function convertTemperature(value, from, to) {
    let kelvin = from === 'c' ? value + 273.15
        : from === 'f' ? (value - 32) * 5 / 9 + 273.15
        : value;
    return to === 'c' ? kelvin - 273.15
        : to === 'f' ? (kelvin - 273.15) * 9 / 5 + 32
        : kelvin;
}

/** Evaluates arithmetic, offline unit conversions, and explicit currency fallback. */
export function evaluateCalculatorInput(input) {
    const arithmetic = evaluateExpression(input);
    if (arithmetic !== null) {
        const value = formatExpressionResult(arithmetic);
        return {display: value, value, copyable: true};
    }
    if (typeof input !== 'string')
        return null;

    const match = input.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s+([a-zA-Z°]+)\s+(?:in|to)\s+([a-zA-Z°]+)$/i);
    if (!match)
        return null;

    const amount = Number(match[1]);
    const from = normalizeUnit(match[2]);
    const to = normalizeUnit(match[3]);
    if (!Number.isFinite(amount))
        return null;

    if (from && to && from.family === to.family) {
        const result = from.family === 'temperature'
            ? convertTemperature(amount, from.unit, to.unit)
            : amount * UNIT_TABLE[from.family][from.unit] / UNIT_TABLE[to.family][to.unit];
        if (!Number.isFinite(result))
            return null;
        const unitLabel = to.unit;
        const display = `${formatExpressionResult(result)} ${unitLabel}`;
        return {display, value: display, copyable: true};
    }

    if (/^[a-z]{3}$/i.test(match[2]) && /^[a-z]{3}$/i.test(match[3])) {
        return {
            display: 'Currency conversion needs a current network rate',
            value: null,
            copyable: false,
        };
    }
    return null;
}
