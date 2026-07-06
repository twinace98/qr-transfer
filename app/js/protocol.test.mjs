// Node test for protocol.js — run: node app/js/protocol.test.mjs
import assert from 'node:assert/strict';
import {
  generateSalt, buildTxInit, buildTxData, buildTxEnd,
  buildRxAckInit, buildRxAck, buildRxAckEnd, parseFrame,
} from './protocol.js';

let n = 0;
const ok = (name) => { n++; console.log(`  ok ${n} - ${name}`); };

// salt format
for (let i = 0; i < 100; i++) {
  assert.match(generateSalt(), /^[0-9a-z]{1,6}$/, 'salt must be <=6 base36 chars');
}
ok('generateSalt format');

// round-trips: build -> parse -> equal fields
{
  const f = { fileName: 'a.txt', mimeType: 'text/plain', nChunks: 3, chunkSize: 250, salt: 'abc123' };
  const p = parseFrame(buildTxInit(f));
  assert.deepEqual(p, { dir: 'TX', type: 'INIT', ...f });
  ok('TX|INIT round-trip');
}
{
  const f = { seq: 5, nChunks: 12, salt: 'x1y2z3', payload: 'SGVsbG8+/w==' };
  const p = parseFrame(buildTxData(f));
  assert.deepEqual(p, { dir: 'TX', type: 'DATA', ...f });
  ok('TX|DATA round-trip (payload with +/=)');
}
{
  const p = parseFrame(buildTxEnd({ nChunks: 7, salt: 'qqqq11' }));
  assert.deepEqual(p, { dir: 'TX', type: 'END', nChunks: 7, salt: 'qqqq11' });
  ok('TX|END round-trip');
}
{
  assert.deepEqual(parseFrame(buildRxAckInit('s1')), { dir: 'RX', type: 'ACK_INIT', salt: 's1' });
  assert.deepEqual(parseFrame(buildRxAck(9, 's2')), { dir: 'RX', type: 'ACK', seq: 9, salt: 's2' });
  assert.deepEqual(parseFrame(buildRxAckEnd('s3')), { dir: 'RX', type: 'ACK_END', salt: 's3' });
  ok('RX ACK frames round-trip');
}

// rejects junk
assert.equal(parseFrame('QR_FTP_IDLE'), null);
assert.equal(parseFrame(''), null);
assert.equal(parseFrame('TX'), null);
assert.equal(parseFrame(42), null);
ok('rejects non-frames');

console.log(`\nprotocol.test: ${n} groups passed`);
