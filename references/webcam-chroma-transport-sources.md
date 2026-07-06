# Webcam transport formats & chroma subsampling — source content notes (2026-07-07)

Consulted for the Phase-4 plan refinement (Q1: is the 4:2:0 penalty real on modern
high-res cameras?). **Content preserved here, not just links** — sites rot.

## 1. w3c/mediacapture-extensions issue #13 (browser format selection)
<https://github.com/w3c/mediacapture-extensions/issues/13>

- Problem: "Capturing in compressed pixel formats such as MJPEG adds CPU overhead because
  the browser has to convert (decompress) every frame before delivery."
- Chromium converts captured frames to I420 internally; format is chosen by resolution
  constraints only. **On USB 2.0 cameras, high-resolution requests default to MJPEG**
  (bandwidth), incurring decompression cost.
- Measured (their table):

  | Format | Resolution | CPU | Power |
  |---|---|---|---|
  | YUY2 | 1280×720 | 30.97 Mcycles/s | 3.31 W |
  | MJPEG | 1280×720 | 67.99 Mcycles/s | 5.28 W |
  | MJPEG | 1920×1080 | 102.41 Mcycles/s | 6.27 W |

  "Capturing in YUY2 at HD instead of MJPEG at Full HD reduces the CPU usage … −70% …
  and the power consumption … −47%."
- Proposal: `avoidCapturingExpensivePixelFormats` boolean constraint (browser may trade
  resolution for an uncompressed format). → No app-level control today; **we cannot
  request a format via getUserMedia**, only resolution (which indirectly selects it).

## 2. USB bandwidth arithmetic (why FHD is MJPEG) — computed, cross-checked vs forum data
- YUY2 (4:2:2) = 2 B/px → 1080p30 = 1920·1080·2·30 ≈ **124 MB/s**; 720p30 ≈ 55 MB/s.
- USB 2.0 effective payload ≈ **35–40 MB/s** (of 60 MB/s raw, minus isochronous overhead).
- Forum-reported reality (Resolume, capture practitioners): 768×576 YUY2 ≈ 22 MB/s works;
  "720p25 needs ~35 MB/s, rarely achievable on real devices"; **1080p uncompressed only at
  very low fps**. → FHD+ webcams ship MJPEG (4:2:0) or NV12 (4:2:0) on USB 2.0-class links.
- Consequence for us: **higher camera resolution ⇒ more certainly 4:2:0 chroma**, unless
  the app deliberately drops resolution to hit a YUY2 (4:2:2) mode.

## 3. UVC payload formats (Wikipedia, USB video device class)
<https://en.wikipedia.org/wiki/USB_video_device_class>
- UVC uncompressed payloads: **YUY2 (4:2:2), NV12 (4:2:0)**. Compressed: **MJPEG**, and in
  UVC 1.5 also H.264/VP8/MPEG — i.e., *every* standard webcam transport is either 4:2:2
  or 4:2:0; **no RGB/4:4:4 transport exists in practice**. Bayer CFA at the sensor already
  halves R/B spatial sampling before any of this.

## 4. MJPG vs YUY2 practical guidance (ezcap vendor note)
<https://www.ezcap.com/News_details/15.html>
- YUY2: uncompressed, low latency, high color fidelity — but bandwidth-limited to low
  res/fps. MJPEG: per-frame JPEG (4:2:0 + quantization artifacts) — recommended for
  720p/1080p because it fits USB. Matches §2 arithmetic.

## 5. NV12 as native webcam format (linux-uvc-devel thread)
<https://linux-uvc-devel.narkive.com/D2FnYRr0/webcam-with-nv12>
- Real UVC webcams exposing NV12 (4:2:0 semi-planar) natively — 4:2:0 even without MJPEG.

## Synthesis (feeds `color-multiplexing-design.md` refinement)
1. 4:2:0 is the **default reality** at HD+; it does NOT go away with better cameras.
2. But at jsQR's ≥3–4 camera px/module operating point the 2×2 chroma footprint is already
   satisfied → penalty appears as **elevated chroma σ + edge MTF loss** (JPEG quantization,
   chroma interpolation), not a 4× area tax → measure per-channel σ (sub-step 4.0).
3. App-side levers: request lower resolution to obtain YUY2 (4:2:2), or accept MJPEG and
   let the 4.2 level-allocator derate chroma-heavy channels.

Related standing references: JAB Code (ISO/IEC 23634), Microsoft HCCB — 8–64-color 2D
codes validating multi-level color PAM (see `color-multiplexing-design.md`).
