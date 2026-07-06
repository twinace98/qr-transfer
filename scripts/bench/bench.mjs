// bench.mjs — headless benchmark harness for the Phase-1 replica.
//
// Drives the UNMODIFIED replica state machines (app/js/{protocol,tx,rx}.js) through a
// virtual clock + seeded drop channel, measuring effective throughput, frame count, and
// SHA-256 correctness. This same harness measures every Phase-3/4 variant later.
//
// Usage:  node scripts/bench/bench.mjs            # demo + determinism check
//         import { runCase } from './bench.mjs'   # programmatic sweep (2.2)

import crypto from 'node:crypto';
import { parseFrame } from '../../app/js/protocol.js';
import { Transmitter } from '../../app/js/tx.js';
import { Receiver } from '../../app/js/rx.js';
import { makeChannel } from './channel.mjs';
import { qrVersionForBytes } from './capacity.mjs';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Run one transfer of `fileBytes` (Buffer) and return metrics.
 * @param {object} o
 * @param {Buffer} o.fileBytes
 * @param {number} o.chunkSize    base64 chars per DATA frame
 * @param {number} [o.fps]        QR display slots per second across both screens (default 15)
 * @param {number} [o.dropProb]   per-frame Tx loss probability (default 0)
 * @param {number} [o.seed]       drop-RNG seed (default 1)
 * @returns {{okSha, bytes, frames, seconds, bytesPerSec, retransmits, maxQrVersion, srcSha, rxSha}}
 */
export function runCase({ fileBytes, chunkSize, fps = 15, dropProb = 0, seed = 1 }) {
  const T = 1 / fps;
  const base64 = fileBytes.toString('base64');
  const srcSha = sha256(fileBytes);

  let clock = 0;
  const tx = new Transmitter({ chunkSize, timeoutMs: 2500, now: () => clock });
  const rx = new Receiver();
  const channel = makeChannel({ dropProb, seed });

  tx.loadBase64(base64, { fileName: 'bench.bin', mimeType: 'application/octet-stream' });

  let received = null;
  rx.onComplete = (b64) => { received = b64; };

  // A "slot" is one QR display on EITHER screen (the two devices alternate showing QRs).
  // Wall-clock = totalSlots / fps. Stop-and-wait costs a DATA slot + an ACK slot per chunk;
  // a one-way (blind-fire) transport will emit no ACK slots -> the handshake cost vanishes.
  let txSlots = 0;    // frames the Tx displays (incl. retransmits of dropped frames)
  let ackSlots = 0;   // ACK frames the Rx displays back (only when a frame is received)
  let retransmits = 0;
  let maxFrameLen = 0;
  const seenPos = new Set();
  let guard = 0;

  while (tx.status !== 'DONE' && guard++ < 5_000_000) {
    const frame = tx.tick();
    if (frame === null) { clock += 100; continue; }  // inside timeout window (ms units for tx clock)

    txSlots++;
    maxFrameLen = Math.max(maxFrameLen, Buffer.byteLength(frame, 'utf8'));
    const posKey = tx.status + ':' + tx.currentSeq;
    if (seenPos.has(posKey)) retransmits++; else seenPos.add(posKey);

    if (channel.lost()) { clock += 100; continue; }  // frame dropped -> Tx will time out & re-show

    const ack = rx.onTxFrame(parseFrame(frame));
    if (ack) { ackSlots++; tx.onAck(parseFrame(ack)); }  // reliable ACK channel (baseline), 1 slot
    clock += 100;
  }

  const okSha = received !== null && sha256(Buffer.from(received, 'base64')) === srcSha;
  const totalSlots = txSlots + ackSlots;
  const seconds = totalSlots * T;

  return {
    okSha,
    bytes: fileBytes.length,
    frames: totalSlots,      // total QR displays across both screens (the wall-clock cost)
    txSlots,
    ackSlots,
    seconds,
    bytesPerSec: seconds > 0 ? fileBytes.length / seconds : 0,
    retransmits,
    maxQrVersion: qrVersionForBytes(maxFrameLen),
    srcSha,
    rxSha: received !== null ? sha256(Buffer.from(received, 'base64')) : null,
  };
}

/** Deterministic test payloads (reused by the 2.2 sweep). */
export function makePayloads() {
  const text = Buffer.from(
    'The quick brown fox jumps over the lazy dog. 0123456789. '.repeat(180), 'utf8'); // ~10 KB
  // "pre-compressed"-like incompressible bytes via chained hashing (deterministic)
  const parts = [];
  for (let i = 0; i < 160; i++) parts.push(crypto.createHash('sha512').update('bench' + i).digest());
  const binary = Buffer.concat(parts).subarray(0, 10 * 1024); // ~10 KB
  return { text, binary };
}

// --- CLI: demo + determinism self-check (2.1 pass criterion) ----------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { text } = makePayloads();
  console.log('fps sensitivity (text, cs=250, drop=0) — note bytesPerSec scales with fps, slots do not:');
  console.table([10, 15, 30, 60].map((fps) => {
    const r = runCase({ fileBytes: text, chunkSize: 250, fps });
    return { fps, txSlots: r.txSlots, ackSlots: r.ackSlots, totalSlots: r.frames, seconds: +r.seconds.toFixed(2), bytesPerSec: Math.round(r.bytesPerSec), qrV: r.maxQrVersion };
  }));

  // Determinism: two runs, same {seed, dropProb} -> identical frames/okSha/bytes.
  const a = runCase({ fileBytes: text, chunkSize: 250, dropProb: 0.05, seed: 42 });
  const b = runCase({ fileBytes: text, chunkSize: 250, dropProb: 0.05, seed: 42 });
  const deterministic = a.frames === b.frames && a.okSha === b.okSha && a.bytes === b.bytes;
  console.log(`determinism (seed=42, drop=5%): frames ${a.frames} == ${b.frames} -> ${deterministic ? 'OK' : 'FAIL'}`);
  console.log(`sha-exact: ${a.okSha ? 'OK' : 'FAIL'}`);
  process.exit(deterministic && a.okSha ? 0 : 1);
}
