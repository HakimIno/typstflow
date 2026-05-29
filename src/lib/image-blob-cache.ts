/**
 * ImageBlobCache — Singleton that converts base64 srcData → ObjectURL once
 * and reuses it across all renders. This avoids the massive cost of:
 *   1. Passing large base64 strings through React's reconciler on every render
 *   2. Browser re-decoding the same base64 data every time
 *   3. Memory pressure from duplicated in-memory image data
 *
 * Cache key: componentId + a short fingerprint of srcData length + first 32 chars
 * so a changed image correctly invalidates the cached URL.
 */

interface CacheEntry {
  objectUrl: string;
  fingerprint: string;
}

const cache = new Map<string, CacheEntry>();

function fingerprint(srcData: string): string {
  return `${srcData.length}:${srcData.slice(0, 32)}`;
}

/**
 * Returns a stable ObjectURL for the given srcData.
 * Creates/revokes ObjectURLs automatically when the image data changes.
 */
export function getImageObjectUrl(componentId: string, srcData: string): string {
  const fp = fingerprint(srcData);
  const existing = cache.get(componentId);

  if (existing && existing.fingerprint === fp) {
    return existing.objectUrl;
  }

  // Revoke old URL to free GPU/browser memory
  if (existing) {
    URL.revokeObjectURL(existing.objectUrl);
  }

  // Convert data URL → Blob → ObjectURL
  let objectUrl: string;
  try {
    const [header, b64] = srcData.split(',');
    if (!b64) {
      // Not a data URL — use as-is (http/https src)
      cache.set(componentId, { objectUrl: srcData, fingerprint: fp });
      return srcData;
    }
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    objectUrl = URL.createObjectURL(blob);
  } catch {
    // Fallback: use srcData directly (won't cache large base64)
    return srcData;
  }

  cache.set(componentId, { objectUrl, fingerprint: fp });
  return objectUrl;
}

/**
 * Call this when a component is removed to free the ObjectURL.
 */
export function revokeImageObjectUrl(componentId: string): void {
  const existing = cache.get(componentId);
  if (existing) {
    URL.revokeObjectURL(existing.objectUrl);
    cache.delete(componentId);
  }
}

/**
 * Call this to clear all cached ObjectURLs (e.g. on schema reset).
 */
export function clearImageBlobCache(): void {
  for (const entry of cache.values()) {
    URL.revokeObjectURL(entry.objectUrl);
  }
  cache.clear();
}
