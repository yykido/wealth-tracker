import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException("Scan canceled", "AbortError"));
    if (signal.aborted) {
      promise.catch(() => {});
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}
export type ScanProgress = { status: string; progress: number };
export async function recognizeScreenshot(
  file: File,
  languages: "eng" | "deu" | "eng+deu",
  signal: AbortSignal,
  onProgress: (p: ScanProgress) => void,
): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PNG, JPEG, or WebP screenshot/photo.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Image must be smaller than 10 MB.");
  let image: ImageBitmap | undefined, worker: Worker | undefined;
  const aborted = () => {
    if (signal.aborted) throw new DOMException("Scan canceled", "AbortError");
  };
  const cancel = () => {
    void worker?.terminate();
  };
  signal.addEventListener("abort", cancel);
  try {
    image = await createImageBitmap(file);
    aborted();
    if (
      image.width * image.height > 24_000_000 ||
      image.width > 10000 ||
      image.height > 20000
    )
      throw new Error(
        "Image dimensions are too large. Crop the payment list first (maximum 24 megapixels).",
      );
    const scale = Math.min(
      2,
      Math.max(1, 1600 / image.width),
      3000 / image.width,
      12000 / image.height,
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot prepare the image.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.filter = "grayscale(1) contrast(1.15)";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    image = undefined;
    const path = new URL("/ocr/", window.location.origin).href;
    const pendingWorker = createWorker(languages, OEM.LSTM_ONLY, {
      workerPath: path + "worker.min.js",
      corePath: path,
      langPath: path,
      workerBlobURL: false,
      logger: (p) => {
        if (!signal.aborted)
          onProgress({ status: p.status, progress: p.progress });
      },
    });
    pendingWorker.then(
      (created) => {
        if (signal.aborted) void created.terminate();
      },
      () => {},
    );
    worker = await abortable(pendingWorker, signal);
    aborted();
    await abortable(
      worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO }),
      signal,
    );
    const { data } = await abortable(worker.recognize(canvas), signal);
    aborted();
    return data.text;
  } finally {
    signal.removeEventListener("abort", cancel);
    image?.close();
    if (worker) await worker.terminate();
  }
}
