import test from 'node:test';
import assert from 'node:assert/strict';

import {qrencodeArguments} from '../lib/qrCodeCommand.js';

test('QR encoding uses PNG stdout and keeps clipboard text out of argv', () => {
    assert.deepEqual(qrencodeArguments(), ['qrencode', '-t', 'PNG', '-o', '-']);
});
