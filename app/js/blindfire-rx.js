// blindfire-rx.js — one-way blind-fire receiver (Phase 3.2).
//
// Feed every scanned packet to `onPacket`; the receiver bootstraps from ANY frame (every
// packet carries k and file_len), CRC-gates corrupt frames, ignores foreign file_ids, and
// peels until the LT decoder completes — zero back-channel. On completion `result()` returns
// the decompressed original bytes.

import { decompress } from './compress.js';
import { LTDecoder, SYSTEMATIC_BASE } from './fountain.js';
import { MAGIC, HEADER_BYTES, crcOverPacket } from './blindfire-tx.js';

/** Parse + CRC-check one wire packet. Returns fields or null if not ours / corrupt. */
export function parsePacket(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length <= HEADER_BYTES) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint16(0) !== MAGIC) return null;
  if (dv.getUint16(14) !== crcOverPacket(bytes)) return null;   // corrupt -> drop pre-decoder
  return {
    fileId: dv.getUint16(2),
    k: dv.getUint16(4),
    fileLen: dv.getUint32(6),
    seed: dv.getUint32(10),
    payload: bytes.subarray(HEADER_BYTES),
  };
}

export class BlindFireReceiver {
  constructor({ lt } = {}) {
    this.lt = lt;
    this.fileId = null;   // locked by the first valid packet
    this.fileLen = null;
    this.dec = null;
    this.packetsSeen = 0; // valid packets for THIS file (overhead accounting)
    this.corrupt = 0;
  }

  get progress() { return this.dec ? this.dec.solved / this.dec.k : 0; }
  get done() { return !!this.dec && this.dec.done; }

  /** Feed one scanned wire packet (Uint8Array). Returns true when the decode just completed. */
  onPacket(bytes) {
    const p = parsePacket(bytes);
    if (!p) { this.corrupt++; return false; }
    if (this.fileId === null) {                    // bootstrap from any frame
      this.fileId = p.fileId;
      this.fileLen = p.fileLen;
      this.dec = new LTDecoder(p.k, p.payload.length, this.lt);
    }
    if (p.fileId !== this.fileId || this.done) return false;
    this.packetsSeen++;
    this.dec.addPacket(p.seed, p.payload);
    return this.done;
  }

  /** Decompress and return the original file bytes. Call once `done`. */
  async result() {
    const tagged = this.dec.join(this.fileLen);
    return decompress(tagged[0], tagged.subarray(1));
  }
}

export { SYSTEMATIC_BASE };
