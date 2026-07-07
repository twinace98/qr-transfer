// camera.js — webcam capture + jsQR scanning (jsQR loaded as a global from app/vendor/).
// Faithful to the original: requestAnimationFrame scan loop, inversionAttempts 'dontInvert',
// facing-mode toggle, and an image-upload fallback when the camera is unavailable.

/**
 * Scanner controller.
 * @param {object} o
 * @param {HTMLVideoElement} o.video
 * @param {HTMLCanvasElement} o.canvas   offscreen canvas used to grab frames
 * @param {(data: string) => void} o.onDecode   called with the decoded QR string
 * @param {(bytes: Uint8Array) => void} [o.onDecodeBinary]  optional: raw byte payload
 *        (jsQR binaryData) — used by the blind-fire mode; replica path ignores it
 * @param {(msg: string) => void} [o.onStatus]
 * @param {(msg: string) => void} [o.onError]
 * @param {() => void} [o.onHit]         called on each successful decode (e.g. flash overlay)
 */
export function createScanner({ video, canvas, onDecode, onDecodeBinary, onStatus, onError, onHit }) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let stream = null;
  let rafId = null;
  let facingMode = 'user';        // original starts on the front/selfie camera

  let _dbg = { frames: 0, hits: 0, lastLen: 0, t: Date.now() };
  function scanTick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      _dbg.frames++;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // eslint-disable-next-line no-undef
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code && (code.data || (code.binaryData && code.binaryData.length))) {
        _dbg.hits++; _dbg.lastLen = code.binaryData ? code.binaryData.length : code.data.length;
        if (code.data) onDecode(code.data);
        if (onDecodeBinary && code.binaryData && code.binaryData.length) onDecodeBinary(new Uint8Array(code.binaryData));
        if (onHit) onHit();
      }
      if (onStatus && Date.now() - _dbg.t > 1000) {
        onStatus(`scanning ${video.videoWidth}x${video.videoHeight} · ${_dbg.frames} fps · QR hits ${_dbg.hits}/s` +
                 (_dbg.lastLen ? ` · last ${_dbg.lastLen} B` : ''));
        _dbg = { frames: 0, hits: 0, lastLen: _dbg.lastLen, t: Date.now() };
      }
    }
    if (stream) rafId = requestAnimationFrame(scanTick);
  }

  async function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (onError) onError('Camera API not available in this environment.');
      return;
    }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (rafId) cancelAnimationFrame(rafId);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      video.srcObject = stream;
      video.setAttribute('playsinline', true);
      await video.play();
      rafId = requestAnimationFrame(scanTick);
      if (onStatus) onStatus(`Camera active (${facingMode}). Scanning...`);
    } catch (err) {
      if (onError) onError(err.message || 'Access denied.');
    }
  }

  async function toggleFacing() {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    if (onStatus) onStatus('Switching camera...');
    await start();
  }

  function stop() {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /** Decode a single QR from an uploaded image File. Returns the string or null. */
  function decodeImageFile(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        // eslint-disable-next-line no-undef
        const code = jsQR(data.data, data.width, data.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) { onDecode(code.data); if (onHit) onHit(); resolve(code.data); }
        else resolve(null);
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });
  }

  return { start, stop, toggleFacing, decodeImageFile, get facingMode() { return facingMode; } };
}
