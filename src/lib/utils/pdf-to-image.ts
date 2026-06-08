'use client';

/**
 * Client-side PDF rasterizer.
 *
 * Renders a PDF page to a high-resolution JPEG data URL so the vision model can
 * read dense text/structure when recreating a layout from an uploaded document.
 * Only used in the browser (pdf.js + canvas) — never import from server code.
 */

// Longest-edge target in pixels. High enough that 7–8pt fine print stays legible
// for the model, low enough to keep the base64 payload reasonable.
const DEFAULT_MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjs) => {
      // Module worker — works with both webpack 5 and Turbopack via import.meta.url.
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(
        new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)
      );
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/** True when the picked file is a PDF (by MIME type or extension). */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/**
 * Render the first page of a PDF to a JPEG data URL.
 * @param file   PDF file from a file input.
 * @param maxEdge Longest-edge target in px (default 2000).
 */
export async function pdfFirstPageToImage(file: File, maxEdge = DEFAULT_MAX_EDGE): Promise<string> {
  const pdfjs = await loadPdfjs();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(1);
    // render() returns a promise; await it properly here.
    const base = page.getViewport({ scale: 1 });
    const longest = Math.max(base.width, base.height);
    const scale = Math.min(maxEdge / longest, 4);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    void loadingTask.destroy();
  }
}
