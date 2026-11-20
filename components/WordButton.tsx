'use client';

/**
 * Downloads the document on screen as a Word file. Word opens HTML saved as .doc, so the file is the same page with
 * print-friendly styles: no extra library, and it always matches what is on screen (20 Nov, as-built for Compleat).
 */
export function WordButton({ fileName, selector = 'article.report' }: { fileName: string; selector?: string }) {
  const download = () => {
    const node = document.querySelector(selector);
    if (!node) return;
    const css = `
      body { font-family: Calibri, Arial, sans-serif; font-size: 10.5pt; color: #111; }
      h1 { font-size: 20pt; margin: 0 0 4pt; } h2 { font-size: 15pt; margin: 18pt 0 6pt; } h3 { font-size: 12pt; margin: 12pt 0 4pt; }
      table { border-collapse: collapse; width: 100%; margin: 4pt 0 10pt; }
      th, td { border: 1px solid #bbb; padding: 3pt 5pt; vertical-align: top; text-align: left; font-size: 9.5pt; }
      th { background: #eef0f4; }
      img { max-height: 48pt; }
      .no-print, button { display: none; }
      .muted, .report-note { color: #555; }
    `;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${fileName}</title><style>${css}</style></head><body>${node.outerHTML}</body></html>`;
    const url = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace(/[^\w\- ]+/g, '').trim() || 'as-built'}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <button className="btn btn-quiet btn-sm" type="button" onClick={download}>
      Download as Word
    </button>
  );
}
