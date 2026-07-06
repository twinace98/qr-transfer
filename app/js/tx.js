// tx.js — Transmitter (Tx) stop-and-wait ARQ state machine, faithful to the original.
//
// States: IDLE -> INIT -> SENDING -> END (-> done).
// The Tx repeatedly displays the frame for its current state. Every TX_TIMEOUT_MS it
// re-rolls the salt and re-displays (retransmission). It advances only when it scans the
// matching RX ACK. This core is DOM/timer-free so it can be driven by a real 100 ms timer
// in the browser or stepped deterministically in tests.

import {
  generateSalt, buildTxInit, buildTxData, buildTxEnd, IDLE_VALUE,
} from './protocol.js';

export const TX_TIMEOUT_MS = 2500;
export const TX_TICK_MS = 100;

export class Transmitter {
  /**
   * @param {object} opts
   * @param {number} opts.chunkSize     base64 chars per DATA frame (100/250/500/800)
   * @param {number} [opts.timeoutMs]   ACK wait before salt re-roll (default 2500)
   * @param {() => number} [opts.now]   clock injection for tests (default Date.now)
   */
  constructor({ chunkSize, timeoutMs = TX_TIMEOUT_MS, now = Date.now } = {}) {
    this.chunkSize = chunkSize;
    this.timeoutMs = timeoutMs;
    this.now = now;

    this.status = 'IDLE';        // IDLE | INIT | SENDING | END | DONE
    this.fileName = '';
    this.mimeType = '';
    this.chunks = [];
    this.currentSeq = 0;
    this.lastTxTime = 0;
    this.currentSalt = '';

    this._timerId = null;
    this.onFrame = null;         // (value, statusText) => void
    this.onProgress = null;      // (current, total) => void
    this.onDone = null;          // () => void
  }

  /** Split an already-computed base64 string into fixed-size character chunks and arm INIT. */
  loadBase64(base64, { fileName, mimeType }) {
    this.fileName = fileName;
    this.mimeType = mimeType || 'application/octet-stream';
    this.chunks = [];
    for (let i = 0; i < base64.length; i += this.chunkSize) {
      this.chunks.push(base64.substring(i, i + this.chunkSize));
    }
    this.status = 'INIT';
    this.currentSeq = 0;
    this.lastTxTime = 0;
  }

  get total() { return this.chunks.length; }

  /**
   * Emit the current-state frame IF the timeout window has elapsed (or a send was forced
   * via lastTxTime=0). Returns the emitted frame string, or null if still waiting.
   * This is the body of the original `txLoop`.
   */
  tick() {
    if (this.status === 'IDLE' || this.status === 'DONE') return null;
    const t = this.now();
    if (t - this.lastTxTime < this.timeoutMs) return null;

    this.currentSalt = generateSalt();
    this.lastTxTime = t;

    let frame = null;
    let statusText = '';
    if (this.status === 'INIT') {
      frame = buildTxInit({
        fileName: this.fileName, mimeType: this.mimeType,
        nChunks: this.total, chunkSize: this.chunkSize, salt: this.currentSalt,
      });
      statusText = `Transmitting INIT [Size: ${this.chunkSize}]... (Waiting for Rx ACK)`;
      this._emitProgress(0);
    } else if (this.status === 'SENDING') {
      frame = buildTxData({
        seq: this.currentSeq, nChunks: this.total,
        salt: this.currentSalt, payload: this.chunks[this.currentSeq],
      });
      statusText = `Transmitting Chunk ${this.currentSeq + 1}/${this.total} (Salt: ${this.currentSalt})`;
      this._emitProgress(this.currentSeq);
    } else if (this.status === 'END') {
      frame = buildTxEnd({ nChunks: this.total, salt: this.currentSalt });
      statusText = 'Transmitting END... (Waiting for final Rx ACK)';
      this._emitProgress(this.total);
    }

    if (frame && this.onFrame) this.onFrame(frame, statusText);
    return frame;
  }

  /**
   * Process an ACK frame (already parsed by protocol.parseFrame). Advances state and forces
   * an immediate re-send (lastTxTime=0) so the next tick transmits without waiting.
   */
  onAck(ack) {
    if (!ack || ack.dir !== 'RX') return;

    if (this.status === 'INIT' && ack.type === 'ACK_INIT') {
      this.status = 'SENDING';
      this.lastTxTime = 0;
    } else if (this.status === 'SENDING' && ack.type === 'ACK') {
      if (ack.seq === this.currentSeq) {
        this.currentSeq++;
        this.lastTxTime = 0;
        if (this.currentSeq >= this.total) this.status = 'END';
      }
    } else if (this.status === 'END' && ack.type === 'ACK_END') {
      this.status = 'DONE';
      this.stop();
      if (this.onFrame) this.onFrame(IDLE_VALUE, 'Transfer Complete!');
      if (this.onDone) this.onDone();
    }
  }

  /** Browser driver: run the 100 ms tick loop. Wire onFrame/onProgress/onDone first. */
  start(tickMs = TX_TICK_MS) {
    this.stop();
    this._timerId = setInterval(() => this.tick(), tickMs);
  }

  stop() {
    if (this._timerId !== null) { clearInterval(this._timerId); this._timerId = null; }
  }

  _emitProgress(current) { if (this.onProgress) this.onProgress(current, this.total); }
}

/** Browser helper: read a File to base64 (strips the data-URL prefix). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
