// e2e.test.mjs — headless loopback: Transmitter <-> Receiver through parseFrame, with a
// virtual clock and an optional frame-drop channel. Verifies the stop-and-wait ARQ core
// (1.3) and byte-exact reconstruction (1.5). Run: node app/js/e2e.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parseFrame } from './protocol.js';
import { Transmitter } from './tx.js';
import { Receiver } from './rx.js';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Run a full transfer of `sourceBytes` (Buffer) at `chunkSize`, dropping frames according
 * to `dropSeq` (a deterministic predicate on a monotonically increasing frame index).
 * Uses a virtual clock so timeout-driven retransmission is exercised without real waiting.
 * Returns { receivedBytes, txFrames, retransmits }.
 */
function runTransfer(sourceBytes, chunkSize, drop = () => false) {
  const base64 = sourceBytes.toString('base64');

  let clock = 0;
  const tx = new Transmitter({ chunkSize, timeoutMs: 2500, now: () => clock });
  const rx = new Receiver();
  tx.loadBase64(base64, { fileName: 'test.bin', mimeType: 'application/octet-stream' });

  let received = null;
  rx.onComplete = (b64, meta) => { received = { b64, meta }; };

  let frameIdx = 0;
  let txFrames = 0;
  let retransmits = 0;
  const seen = new Set();
  let guard = 0;

  while (tx.status !== 'DONE' && guard++ < 1_000_000) {
    const frame = tx.tick();
    if (frame === null) { clock += 100; continue; } // still within timeout window

    txFrames++;
    const key = frame.slice(0, frame.indexOf('|', frame.indexOf('|') + 1)); // dir|type prefix
    // count a retransmit when the same logical position is sent again
    const posKey = tx.status + ':' + tx.currentSeq;
    if (seen.has(posKey)) retransmits++; else seen.add(posKey);

    const i = frameIdx++;
    if (drop(i)) { clock += 100; continue; } // frame lost -> Tx will time out and re-roll

    const ack = rx.onTxFrame(parseFrame(frame));
    if (ack) tx.onAck(parseFrame(ack));       // ack channel assumed reliable here
    clock += 100;
  }

  assert.notEqual(received, null, 'transfer did not complete');
  return {
    receivedBytes: Buffer.from(received.b64, 'base64'),
    txFrames, retransmits,
  };
}

let n = 0;
const ok = (m) => console.log(`  ok ${++n} - ${m}`);

// --- Case A: text file, clean channel, default 250 chunk ---------------------
{
  const src = Buffer.from('The quick brown fox jumps over the lazy dog. '.repeat(50), 'utf8');
  const { receivedBytes } = runTransfer(src, 250);
  assert.equal(sha256(receivedBytes), sha256(src), 'text sha256 mismatch');
  ok(`text round-trip byte-exact (${src.length} B, sha ${sha256(src).slice(0, 12)}…)`);
}

// --- Case B: pseudo-binary file (PNG-like bytes), all chunk sizes ------------
{
  const src = crypto.createHash('sha512').update('seed').digest();
  const big = Buffer.concat(Array.from({ length: 40 }, (_, i) =>
    crypto.createHash('sha512').update('seed' + i).digest()));
  const bin = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), src, big]); // fake PNG header
  for (const cs of [100, 250, 500, 800]) {
    const { receivedBytes, txFrames } = runTransfer(bin, cs);
    assert.equal(sha256(receivedBytes), sha256(bin), `binary sha256 mismatch @cs=${cs}`);
    ok(`binary round-trip byte-exact @chunkSize=${cs} (${txFrames} frames)`);
  }
}

// --- Case C: lossy channel — every 3rd frame dropped; must still complete ----
{
  const src = Buffer.from('lossy-channel payload '.repeat(80), 'utf8');
  const clean = runTransfer(src, 250);
  const lossy = runTransfer(src, 250, (i) => i % 3 === 0);
  assert.equal(sha256(lossy.receivedBytes), sha256(src), 'lossy sha256 mismatch');
  assert.ok(lossy.retransmits > 0, 'expected retransmissions on lossy channel');
  assert.ok(lossy.txFrames > clean.txFrames, 'lossy transfer should cost more frames');
  ok(`lossy channel recovers via retransmit (clean=${clean.txFrames} vs lossy=${lossy.txFrames} frames)`);
}

console.log(`\ne2e.test: ${n} checks passed`);
