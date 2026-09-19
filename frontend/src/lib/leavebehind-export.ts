/** Leave-behind export helpers for facilitator workshop boards. */

export function downloadPngFromBase64(base64: string, filename = 'workshop-board.png'): void {
  if (!base64) {
    throw new Error('Nothing to export. Add shapes to the Drawing Area first.');
  }
  const link = document.createElement('a');
  link.href = `data:image/png;base64,${base64}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Zero-dependency PDF leave-behind via a print window.
 * Facilitator chooses "Save as PDF" in the print dialog.
 */
export function openPdfPrintFromBase64(base64: string, title = 'Workshop leave-behind'): void {
  if (!base64) {
    throw new Error('Nothing to export. Add shapes to the Drawing Area first.');
  }
  const w = window.open('', '_blank');
  if (!w) {
    throw new Error('Pop-up blocked. Allow pop-ups to export PDF.');
  }
  w.document.write(`<!doctype html><html><head><title>${title}</title>
<style>
  html, body { margin: 0; padding: 0; }
  img { width: 100%; height: auto; display: block; }
  @page { margin: 12mm; }
</style></head><body>
<img src="data:image/png;base64,${base64}" alt="${title}" />
<script>window.onload = function () { window.focus(); window.print(); };</script>
</body></html>`);
  w.document.close();
}

export function assertExportablePngBase64(base64: string | null | undefined): string {
  if (!base64 || base64.length < 32) {
    throw new Error('Empty board export');
  }
  return base64;
}
