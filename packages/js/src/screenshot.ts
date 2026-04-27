// Customer-side screen capture for the embedded widget. Wraps
// `getDisplayMedia` so the customer can hand a single frame to the agent
// without leaving the page.
//
// Two failure modes the UI cares about distinguishing:
// - `ScreenshotCancelled`: the user dismissed the picker (NotAllowedError /
//   AbortError). Don't show an error — the user *intended* to cancel.
// - `ScreenshotUnavailable`: anything else (no API, codec failure, frame
//   grab returned 0×0, etc.). Surface a user-visible failure.

export class ScreenshotCancelled extends Error {
  constructor(message = "Screenshot cancelled") {
    super(message);
    this.name = "ScreenshotCancelled";
  }
}

export class ScreenshotUnavailable extends Error {
  constructor(message = "Screenshot unavailable") {
    super(message);
    this.name = "ScreenshotUnavailable";
  }
}

const MAX_DIMENSION = 2048;
const SIZE_BUDGET = 5 * 1024 * 1024; // 5 MB — match the server cap.

// Feature gate: desktop pointer-fine browsers only. Mobile browsers often
// expose `getDisplayMedia` and then throw at runtime; suppress the entry
// point there.
export function canCaptureScreenshot(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }
  if (!navigator.mediaDevices?.getDisplayMedia) return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: fine)").matches;
}

export async function captureScreenshot(): Promise<Blob> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    throw new ScreenshotUnavailable("Screen capture not supported");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
  } catch (e) {
    if (
      e instanceof Error &&
      (e.name === "NotAllowedError" || e.name === "AbortError")
    ) {
      throw new ScreenshotCancelled(e.message);
    }
    const msg = e instanceof Error ? e.message : "Screen capture failed";
    throw new ScreenshotUnavailable(msg);
  }

  try {
    const bitmap = await grabFrame(stream);
    return await encodeJpeg(bitmap);
  } finally {
    for (const track of stream.getTracks()) track.stop();
  }
}

async function grabFrame(stream: MediaStream): Promise<ImageBitmap> {
  const [track] = stream.getVideoTracks();
  if (!track) throw new ScreenshotUnavailable("No video track");

  // Prefer ImageCapture when available — it's a direct path to a frame.
  const ImageCaptureCtor = (
    globalThis as unknown as {
      ImageCapture?: new (track: MediaStreamTrack) => {
        grabFrame(): Promise<ImageBitmap>;
      };
    }
  ).ImageCapture;
  if (ImageCaptureCtor) {
    try {
      const cap = new ImageCaptureCtor(track);
      const bitmap = await cap.grabFrame();
      if (bitmap.width > 0 && bitmap.height > 0) return bitmap;
    } catch {
      // Fall through to the <video> path.
    }
  }

  // Fallback: pipe the stream through a hidden <video>, draw to canvas,
  // then convert to ImageBitmap.
  return await grabFrameFromVideo(stream);
}

async function grabFrameFromVideo(stream: MediaStream): Promise<ImageBitmap> {
  const video = document.createElement("video");
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  try {
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        video.removeEventListener("loadedmetadata", onReady);
        resolve();
      };
      const onError = () => {
        video.removeEventListener("error", onError);
        reject(new ScreenshotUnavailable("Video element failed"));
      };
      video.addEventListener("loadedmetadata", onReady);
      video.addEventListener("error", onError);
    });
    await video.play().catch(() => {});
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) throw new ScreenshotUnavailable("Empty frame");
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ScreenshotUnavailable("No 2D context");
    ctx.drawImage(video, 0, 0, w, h);
    return await createImageBitmap(canvas);
  } finally {
    video.srcObject = null;
  }
}

async function encodeJpeg(bitmap: ImageBitmap): Promise<Blob> {
  const { width, height } = scaleToFit(
    bitmap.width,
    bitmap.height,
    MAX_DIMENSION,
  );
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = (
    canvas as unknown as {
      getContext(type: "2d"): CanvasRenderingContext2D | null;
    }
  ).getContext("2d");
  if (!ctx) throw new ScreenshotUnavailable("No 2D context");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await canvasToBlob(canvas, 0.85);
  if (blob.size <= SIZE_BUDGET) return blob;
  const slim = await canvasToBlob(canvas, 0.7);
  return slim;
}

function scaleToFit(
  w: number,
  h: number,
  max: number,
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w >= h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number,
): Promise<Blob> {
  if ("convertToBlob" in canvas) {
    return await (canvas as OffscreenCanvas).convertToBlob({
      type: "image/jpeg",
      quality,
    });
  }
  return await new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) =>
        b ? resolve(b) : reject(new ScreenshotUnavailable("Encode failed")),
      "image/jpeg",
      quality,
    );
  });
}
