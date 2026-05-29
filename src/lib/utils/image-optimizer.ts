/**
 * Optimizes an image for the report designer.
 * Resizes to a max dimension and compresses to WebP. Uses async APIs throughout
 * (createImageBitmap + toBlob + FileReader) so the main thread is never blocked
 * for more than a few ms — encoding runs on a browser worker thread.
 */
export async function optimizeImage(
  file: File,
  maxDimension = 1600,
  quality = 0.8
): Promise<{ dataUrl: string; mimeType: string }> {
  // 1. Off-thread decode (createImageBitmap is much faster than <img> for large files)
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // 2. Compute target dimensions preserving aspect ratio
  if (width > height) {
    if (width > maxDimension) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    }
  } else if (height > maxDimension) {
    width = Math.round((width * maxDimension) / height);
    height = maxDimension;
  }

  // 3. Draw to OffscreenCanvas when available (resize on GPU, off main thread)
  const useOffscreen = typeof OffscreenCanvas !== 'undefined';
  const canvas: OffscreenCanvas | HTMLCanvasElement = useOffscreen
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) {
    bitmap.close();
    throw new Error('Failed to get canvas context');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // 4. Encode via toBlob (async — runs on a browser worker thread, doesn't block UI)
  const mimeType = 'image/webp';
  const blob: Blob = useOffscreen
    ? await (canvas as OffscreenCanvas).convertToBlob({ type: mimeType, quality })
    : await new Promise<Blob>((resolve, reject) => {
        (canvas as HTMLCanvasElement).toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
          mimeType,
          quality,
        );
      });

  // 5. Convert blob → data URL (FileReader is async, off main thread)
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });

  return { dataUrl, mimeType };
}
