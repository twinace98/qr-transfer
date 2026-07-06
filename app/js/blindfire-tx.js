// blindfire-tx.js — one-way blind-fire sender (Phase 3.2).
//
// Pipeline: compress (whole file) → prepend 1-byte method tag → split into k fixed-size
// blocks → LT-encode → emit packets forever (systematic pass first). No ACK handling at all;
// the sender needs no camera. Every packet carries (k, file_len) so a receiver can bootstrap
// from ANY frame.
//
// Packet layout (16-byte header + payload), byte offsets, big-endian:
//   [0..1]  magic 0x5146 ('QF')
//   [2..3]  file_id  (random per transfer; receiver ignores foreign ids)
//   [4..5]  k        (number of source blocks)
//   [6..9]  file_len (bytes of method-tagged compressed stream = 1 + compressed length)
//   [10..13] seed    (>= SYSTEMATIC_BASE -> raw block seed-BASE, else LT droplet seed)
//   [14..15] CRC16-CCITT over header[0..13] + payload
//   [16..]  payload  (blockSize bytes)

import { compress } from './compress.js';
import { LTEncoder, splitBlocks } from './fountain.js';

export const MAGIC = 0x5146;
export const HEADER_BYTES = 16;

/** CRC16-CCITT (poly 0x1021, init 0xFFFF) — cheap integrity gate so QR EC can drop to L. */
export function crc16(bytes, start = 0, end = bytes.length) {
  let crc = 0xFFFF;
  for (let i = start; i < end; i++) {
    crc ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc;
}

/** Serialize one packet. Exported for tests and the receiver's parser round-trip. */
export function buildPacket({ fileId, k, fileLen, seed, payload }) {
  const pkt = new Uint8Array(HEADER_BYTES + payload.length);
  const dv = new DataView(pkt.buffer);
  dv.setUint16(0, MAGIC);
  dv.setUint16(2, fileId);
  dv.setUint16(4, k);
  dv.setUint32(6, fileLen);
  dv.setUint32(10, seed >>> 0);
  pkt.set(payload, HEADER_BYTES);
  dv.setUint16(14, crcOverPacket(pkt)); // CRC over header[0..13]+payload (skips CRC field)
  return pkt;
}

/** CRC over header[0..13] + payload, skipping the CRC field itself. */
export function crcOverPacket(pkt) {
  let crc = 0xFFFF;
  const feed = (i) => {
    crc ^= pkt[i] << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  };
  for (let i = 0; i < 14; i++) feed(i);
  for (let i = HEADER_BYTES; i < pkt.length; i++) feed(i);
  return crc;
}

export class BlindFireSender {
  /**
   * @param {Uint8Array} tagged  method-tagged compressed stream (built by `create`)
   * @param {number} blockSize   payload bytes per packet
   * @param {number} fileId
   * @param {{c?:number, delta?:number}} [lt]
   */
  constructor(tagged, blockSize, fileId, lt = {}) {
    this.fileId = fileId & 0xFFFF;
    this.fileLen = tagged.length;
    this.blockSize = blockSize;
    const blocks = splitBlocks(tagged, blockSize);
    this.k = blocks.length;
    this.enc = new LTEncoder(blocks, lt);
  }

  /** Compress `fileBytes`, tag the method byte, return a ready sender. */
  static async create(fileBytes, { blockSize, fileId = (Math.random() * 0x10000) | 0, lt } = {}) {
    const { method, data } = await compress(fileBytes);
    const tagged = new Uint8Array(1 + data.length);
    tagged[0] = method;
    tagged.set(data, 1);
    return new BlindFireSender(tagged, blockSize, fileId, lt);
  }

  /** Next wire packet (Uint8Array). Infinite; call at the display frame rate. */
  nextPacket() {
    const { seed, data } = this.enc.next();
    return buildPacket({ fileId: this.fileId, k: this.k, fileLen: this.fileLen, seed, payload: data });
  }
}
