// colorframe.js — live color frame layout: calibration-strip border + 6-plane body (5.1).
//
// Geometry (all in "cell" units; 1 cell = STRIP_CELL px when rasterized):
//   ┌ strip: top row of patches ┐
//   │ [K][W][R1..R8][G1..G8][B1..B8] laid clockwise around the border, 1 cell thick │
//   │ ┌──────── body: W×W px, the 6-plane color QR composite ────────┐ │
// The strip patch sequence and values come from calibrate.stripPatches(); positions are
// deterministic so TX (painter) and RX (sampler) share this module. Pure logic here —
// canvas I/O stays in the callers.

import { stripPatches } from './calibrate.js';
import { composeModulesGrid, PEDESTAL } from './colorplane.js';

export const STRIP_CELL = 24;   // px per strip patch cell (camera needs ≥ ~8 px after scaling)
export const BODY_MARGIN = 8;   // white px between strip and body

/**
 * Frame geometry for a square body of `bodyPx` pixels.
 * Strip patches are laid clockwise along the TOP edge first (as many as fit), then RIGHT,
 * BOTTOM, LEFT. Returns pixel rects per patch + total frame size.
 */
export function frameLayout(bodyPx) {
  const patches = stripPatches();            // 26 displayed-RGB triples
  const cell = STRIP_CELL;
  const inner = bodyPx + 2 * BODY_MARGIN;
  const side = inner;                        // patches run along each edge of the inner square
  const total = inner + 2 * cell;
  const rects = [];
  const perEdge = Math.ceil(patches.length / 4);
  const step = side / perEdge;
  for (let i = 0; i < patches.length; i++) {
    const edge = Math.floor(i / perEdge), t = (i % perEdge) * step;
    let x, y, w, h;
    if (edge === 0)      { x = cell + t; y = 0;            w = step; h = cell; }   // top
    else if (edge === 1) { x = cell + inner; y = cell + t; w = cell; h = step; }   // right
    else if (edge === 2) { x = cell + side - t - step; y = cell + inner; w = step; h = cell; } // bottom
    else                 { x = 0; y = cell + side - t - step; w = cell; h = step; } // left
    rects.push({ x, y, w, h, rgb: patches[i] });
  }
  return { total, cell, bodyOrigin: cell + BODY_MARGIN, bodyPx, rects, patches };
}

/**
 * Compose the full frame as raw RGBA (Uint8ClampedArray) — strip border + 6-plane body.
 * planes: 6 pixel bitmaps of the body (bodyPx × bodyPx, 0/1). White background elsewhere.
 */
export function composeFrameRGBA(planes, bodyPx, alloc = { R: 2, G: 2, B: 2 }) {
  const L = frameLayout(bodyPx);
  const T = L.total;
  const img = new Uint8ClampedArray(T * T * 4).fill(255);
  // strip patches
  for (const r of L.rects) {
    for (let y = Math.round(r.y); y < Math.round(r.y + r.h); y++) {
      for (let x = Math.round(r.x); x < Math.round(r.x + r.w); x++) {
        const o = 4 * (y * T + x);
        img[o] = r.rgb[0]; img[o + 1] = r.rgb[1]; img[o + 2] = r.rgb[2];
      }
    }
  }
  // body: per-pixel 6-plane composition
  const rgb = composeModulesGrid(planes, alloc, PEDESTAL);
  const o0 = L.bodyOrigin;
  for (let y = 0; y < bodyPx; y++) {
    for (let x = 0; x < bodyPx; x++) {
      const m = y * bodyPx + x;
      const o = 4 * ((y + o0) * T + (x + o0));
      img[o] = rgb.R[m]; img[o + 1] = rgb.G[m]; img[o + 2] = rgb.B[m];
    }
  }
  return { data: img, width: T, height: T };
}

/**
 * RX side: sample the strip + extract the body from a captured frame ALIGNED to the same
 * layout (loopback: exact; live: caller maps the guide-box region into this coordinate
 * space first). Returns {observedStrip, body:{R,G,B}} ready for estimateModel/decodeSIC.
 */
export function sampleFrame(img, bodyPx) {
  const L = frameLayout(bodyPx);
  const T = L.total;
  const observedStrip = L.rects.map((r) => {
    const xs = [], n = 6;                    // 6×6 grid inside the central 60 % of the patch
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const px = Math.round(r.x + r.w * (0.2 + 0.6 * (i / (n - 1))));
      const py = Math.round(r.y + r.h * (0.2 + 0.6 * (j / (n - 1))));
      const o = 4 * (py * T + px);
      xs.push([img.data[o], img.data[o + 1], img.data[o + 2]]);
    }
    return xs;                               // raw samples; caller computes meanLin/std
  });
  const body = { R: new Float64Array(bodyPx * bodyPx), G: new Float64Array(bodyPx * bodyPx), B: new Float64Array(bodyPx * bodyPx) };
  const o0 = L.bodyOrigin;
  for (let y = 0; y < bodyPx; y++) {
    for (let x = 0; x < bodyPx; x++) {
      const o = 4 * ((y + o0) * L.total + (x + o0));
      const m = y * bodyPx + x;
      body.R[m] = img.data[o]; body.G[m] = img.data[o + 1]; body.B[m] = img.data[o + 2];
    }
  }
  return { observedStrip, body, layout: L };
}
