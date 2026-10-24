// SPDX-License-Identifier: GPL-2.0-or-later

import test from 'node:test';
import assert from 'node:assert/strict';

import {evaluateExpression, formatExpressionResult, evaluateCalculatorInput} from '../lib/calculator.js';

test('evaluates arithmetic with precedence and parentheses', () => {
    assert.equal(evaluateExpression('2 + 3 * 4'), 14);
    assert.equal(evaluateExpression('(2 + 3) * 4'), 20);
    assert.equal(evaluateExpression('18 / 3 - 2'), 4);
    assert.equal(evaluateExpression('2^3^2'), 512);
    assert.equal(evaluateExpression('-2^2'), -4);
    assert.equal(evaluateExpression('2^-2'), 0.25);
    assert.equal(evaluateExpression('-4 + +6'), 2);
    assert.equal(evaluateExpression('7 % 4'), 3);
});

test('accepts decimals and scientific notation', () => {
    assert.equal(evaluateExpression('.5 * 8'), 4);
    assert.equal(evaluateExpression('1.2e3 / 6'), 200);
});

test('rejects malformed, incomplete, and unsafe expressions', () => {
    for (const input of [
        '', ' ', '2 +', '(2 + 3', '2 + 3)', '2 ** 3', '2 / 0',
        '4 % 0', '1e999', '2; process.exit()', 'globalThis', '1 + alert(1)',
    ])
        assert.equal(evaluateExpression(input), null, input);
    assert.equal(evaluateExpression('1'.repeat(257)), null);
    assert.equal(evaluateExpression('('.repeat(130) + '1' + ')'.repeat(130)), null);
});

test('formats finite results without unnecessary trailing zeroes', () => {
    assert.equal(formatExpressionResult(4), '4');
    assert.equal(formatExpressionResult(1 / 3), '0.333333333333');
    assert.equal(formatExpressionResult(Infinity), null);
});

test('converts common units offline', () => {
    assert.equal(evaluateCalculatorInput('100 km in mi').value, '62.1371192237 mi');
    assert.equal(evaluateCalculatorInput('100 km in mi').copyable, true);
    assert.equal(evaluateCalculatorInput('2 kg to g').value, '2000 g');
    assert.equal(evaluateCalculatorInput('0 c in f').value, '32 f');
    assert.equal(evaluateCalculatorInput('1 day in h').value, '24 h');
});

test('reports currency conversion as network-dependent without inventing rates', () => {
    assert.deepEqual(evaluateCalculatorInput('10 usd in bdt'), {
        display: 'Currency conversion needs a current network rate',
        value: null,
        copyable: false,
    });
});

test('rejects temperatures below absolute zero', () => {
    assert.equal(evaluateCalculatorInput('-274 c in k'), null);
    assert.equal(evaluateCalculatorInput('-460 f in c'), null);
    assert.equal(evaluateCalculatorInput('-1 k in c'), null);
    assert.equal(evaluateCalculatorInput('-273.150001 c in k'), null);
    assert.equal(evaluateCalculatorInput('-459.670001 f in k'), null);
    assert.equal(evaluateCalculatorInput('-273.15 c in k').value, '0 k');
    assert.equal(evaluateCalculatorInput('-459.67 f in c').value, '-273.15 c');
    assert.equal(evaluateCalculatorInput('-459.67 f in k').value, '0 k');
    assert.equal(evaluateCalculatorInput('0 k in c').value, '-273.15 c');
});
