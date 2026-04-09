/**
 * Utilities for triggering browser downloads for different file types.
 */

export function downloadBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export function downloadText(content: string, fileName: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  downloadBlob(blob, fileName);
}

export function downloadPdf(data: Uint8Array, fileName: string) {
  const blob = new Blob([data], { type: 'application/pdf' });
  downloadBlob(blob, fileName);
}
