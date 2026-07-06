// rx.js — Receiver (Rx) state machine, faithful to the original.
//
// States: WAIT_INIT -> RECEIVING -> DONE.
// For every scanned TX frame the Rx displays a matching RX ACK on its own screen (the
// reverse optical channel). ACK replies are idempotent so a Tx that missed an ACK and
// re-sent the same frame simply gets the ACK again. DOM/timer-free core.

import {
  generateSalt, buildRxAckInit, buildRxAck, buildRxAckEnd,
} from './protocol.js';

export class Receiver {
  constructor() {
    this.status = 'WAIT_INIT';   // WAIT_INIT | RECEIVING | DONE
    this.fileName = '';
    this.mimeType = '';
    this.totalChunks = 0;
    this.expectedSeq = 0;
    this.chunks = [];
    this.chunkSize = 0;

    this.onFrame = null;         // (value, statusText) => void   (the ACK to display)
    this.onProgress = null;      // (current, total) => void
    this.onComplete = null;      // (base64, {fileName, mimeType}) => void
  }

  /**
   * Process a parsed TX frame. Updates state and displays the matching ACK via onFrame.
   * Returns the ACK frame string (also handy for the loopback driver/tests).
   */
  onTxFrame(f) {
    if (!f || f.dir !== 'TX') return null;
    let ack = null;

    if (f.type === 'INIT') {
      if (this.status === 'WAIT_INIT') {
        this.fileName = f.fileName;
        this.mimeType = f.mimeType;
        this.totalChunks = f.nChunks;
        this.chunkSize = f.chunkSize;
        this.expectedSeq = 0;
        this.chunks = new Array(f.nChunks).fill(null);
        this.status = 'RECEIVING';
        this._emitProgress(0);
      }
      // Always ACK INIT (in case Tx missed our first ACK).
      ack = buildRxAckInit(generateSalt());
      this._emit(ack, `Sending ACK_INIT (Salt: ${f.salt})`);
    } else if (f.type === 'DATA' && this.status === 'RECEIVING') {
      if (f.seq === this.expectedSeq) {
        this.chunks[f.seq] = f.payload;
        this.expectedSeq++;
        this._emitProgress(this.expectedSeq);
      }
      // ACK whatever sequence we just saw (matches original semantics).
      ack = buildRxAck(f.seq, generateSalt());
      this._emit(ack, `Sending ACK for chunk ${f.seq}`);
    } else if (f.type === 'END') {
      ack = buildRxAckEnd(generateSalt());
      this._emit(ack, `Sending ACK_END (Salt: ${f.salt})`);
      if (this.status === 'RECEIVING' && this.expectedSeq === this.totalChunks) {
        this.status = 'DONE';
        if (this.onComplete) {
          this.onComplete(this.getBase64(), { fileName: this.fileName, mimeType: this.mimeType });
        }
      }
    }
    return ack;
  }

  /** Joined base64 of all received chunks. */
  getBase64() { return this.chunks.join(''); }

  _emit(value, statusText) { if (this.onFrame) this.onFrame(value, statusText); }
  _emitProgress(current) { if (this.onProgress) this.onProgress(current, this.totalChunks); }
}

/** Browser helper: base64 -> Blob (+ object URL) for download. */
export function base64ToBlob(base64, mimeType) {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}
