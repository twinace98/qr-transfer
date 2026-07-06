# Color multiplexing design notes (user-provided, 2026-07-07) — Phase 4 spec basis

## Level budget: 4 levels/channel = 64 colors = 6 bits/module is the sweet spot
- Per-channel PAM instead of binary on/off. Precedent: JAB Code (ISO/IEC 23634), Microsoft HCCB (8-64 colors).
- Noise budget: after gamma linearization + calibration, display->webcam residual noise
  sigma ~ 5-10 (8-bit scale). L levels -> decision gap Delta = 255/(L-1), SER ~ 2Q(Delta/2sigma):
  - L=2: Delta=255 -> error-free
  - L=4: Delta=85 -> 4-8 sigma -> negligible errors. SAFE
  - L=8: Delta=36 -> ~2 sigma -> few % module errors; risky on auto-exposure webcams
- => 2 bits/channel x 3 channels = 6 bits/module realistic ceiling (6x over B/W QR).

## The real trap: chroma subsampling
- Webcams mostly ship MJPEG 4:2:0 at 1080p (USB bandwidth) -> chroma spatial resolution is
  HALF of luma. Color modules must span >= 2x2 camera pixels -> 4x area penalty.
- With that penalty: 8 colors (3 bits) is a net LOSS (3/4 of B/W); 64 colors only ~1.5x.
- Mitigations:
  1. getUserMedia at lower resolution to get uncompressed YUY2 (4:2:2), or
  2. design to the physics: high-res binary QR on luma (Y) + low-res data on chroma (Cb/Cr)
     — same band allocation as analog color TV; optimal because the subsampling structure matches.

## Implementation trick: bit-plane decomposition, reuse jsQR
- Do NOT write a 64-color custom decoder. Encode 2 bits/channel as TWO binary QR planes per
  channel; each plane is decodable by stock jsQR after channel separation + thresholding.
- (Transcription note: original message truncated mid-sentence at the bit-plane section;
  ask user for the rest at Phase-4 kickoff.)

## Gate 3 tie-in (Plan.md)
- Pass: >= 4 levels/channel decoded with fountain overhead < ~15%; else stop at Phase-3 gain.
