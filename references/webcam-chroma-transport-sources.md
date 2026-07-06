# Webcam transport formats & chroma subsampling — source notes (2026-07-07)

Consulted for the Phase-4 plan refinement (Q1: is the 4:2:0 penalty real on modern
high-res cameras?). Conclusion drawn: 1080p+ uncompressed exceeds USB bandwidth, so
high-res webcams ship MJPEG/NV12 (both 4:2:0) — higher resolution makes chroma
subsampling MORE certain, not less; browsers may even prefer low-res YUY2 to avoid
MJPEG decode cost.

| Source | What it supported |
|---|---|
| [USB video device class — Wikipedia](https://en.wikipedia.org/wiki/USB_video_device_class) | UVC payload formats (MJPEG/YUY2/NV12); uncompressed bandwidth limits on USB. |
| [w3c/mediacapture-extensions #13](https://github.com/w3c/mediacapture-extensions/issues/13) | getUserMedia has no format constraint; Chromium may pick lower-res YUY2 over MJPEG (decode cost); FHD often MJPEG-only. |
| [MJPEG At Source Autodecode for UVC — Microsoft Learn](https://learn.microsoft.com/en-us/windows-hardware/drivers/stream/mjpeg-at-source-autodecode-for-uvc) | OS-level MJPEG decode path for UVC webcams (MJPEG prevalence at HD). |
| [MJPG vs YUY2 — ezcap](https://www.ezcap.com/News_details/15.html) | YUY2 (4:2:2 uncompressed) practical only at low res/fps; MJPEG recommended for HD — the bandwidth trade. |
| [Linux-uvc-devel: Webcam with nv12](https://linux-uvc-devel.narkive.com/D2FnYRr0/webcam-with-nv12) | NV12 (4:2:0 semi-planar) as a native UVC webcam format. |

Related standing references: JAB Code (ISO/IEC 23634), Microsoft HCCB — multi-color 2D
codes validating 8–64 color PAM (cited in `color-multiplexing-design.md`).
