/**
 * Holds preview SVG strings outside React state.
 * Exposes blob URLs for <img> rendering to avoid large string props and
 * repeated dangerouslySetInnerHTML reconciliation on virtualizer scroll.
 */
export class PreviewSvgCache {
  private blobUrls: (string | null)[] = [];
  private generation = 0;

  get version(): number {
    return this.generation;
  }

  get pageCount(): number {
    return this.blobUrls.length;
  }

  bump(): void {
    this.generation++;
  }

  getBlobUrl(pageIndex: number): string | null {
    return this.blobUrls[pageIndex] ?? null;
  }

  setPage(pageIndex: number, svg: string): void {
    while (this.blobUrls.length <= pageIndex) {
      this.blobUrls.push(null);
    }
    const prev = this.blobUrls[pageIndex];
    if (prev) URL.revokeObjectURL(prev);
    this.blobUrls[pageIndex] = URL.createObjectURL(
      new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    );
    this.generation++;
  }

  /** Replace entire cache — revokes all previous blob URLs. */
  setAll(pages: string[]): void {
    this.clear();
    for (let i = 0; i < pages.length; i++) {
      const svg = pages[i];
      if (svg) this.setPage(i, svg);
    }
  }

  /** Patch specific page indices without touching others. */
  patchPages(updates: Array<{ index: number; svg: string }>): void {
    for (const { index, svg } of updates) {
      this.setPage(index, svg);
    }
  }

  clear(): void {
    for (const url of this.blobUrls) {
      if (url) URL.revokeObjectURL(url);
    }
    this.blobUrls = [];
    this.generation++;
  }
}
