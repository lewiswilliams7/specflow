'use client';

/** Opens the browser's print dialog, where "Save as PDF" makes the file to send. */
export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <button className="btn btn-primary btn-sm" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
