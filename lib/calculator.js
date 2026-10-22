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
        return parsePrimary();
    }

    function parsePower() {
        const left = parseUnary();
        if (peek() === '^') {
            consume();
            return left ** parsePower();
        }
        return left;
    }

    function parseMultiplicative() {
        let value = parsePower();
        while (['*', '/', '%'].includes(peek())) {
            const operator = consume();
            const right = parsePower();
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
