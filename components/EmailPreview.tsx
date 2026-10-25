'use client';

import { useEffect, useRef, useState } from 'react';

/** Halo $variables shown highlighted, so it's clear which parts Halo fills in. */
const markVariables = (html: string) =>
  html.replace(/\$[A-Za-z][A-Za-z0-9_]*/g, (v) => `<span style="background:#fff3c4;color:#5c4400;border-radius:3px;padding:0 3px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.9em;">${v}</span>`);

/** An email exactly as it will be sent, in a sandboxed frame (no scripts, no access to the page). */
export function EmailPreview({ subject, html, title = 'Email preview' }: { subject?: string; html: string; title?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(360);
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"></head><body style="margin:0;background:#f4f5f7;">${markVariables(html)}</body></html>`;

  const fit = () => {
    try {
      const h = frame.current?.contentDocument?.documentElement.scrollHeight;
      if (h) setHeight(Math.min(Math.max(h + 2, 200), 1000));
    } catch {
      // sandboxed: keep the default height
    }
  };
  // srcDoc can finish loading before React attaches onLoad: measure once after mount and on every change too.
  useEffect(() => {
    const t = setTimeout(fit, 60);
    return () => clearTimeout(t);
  }, [doc]);

  return (
    <div className="email-preview">
      {subject ? (
        <div className="email-subject">
          <span>Subject</span>
          <b dangerouslySetInnerHTML={{ __html: markVariables(subject.replace(/&/g, '&amp;').replace(/</g, '&lt;')) }} />
        </div>
      ) : null}
      <iframe ref={frame} title={title} sandbox="allow-same-origin" srcDoc={doc} onLoad={fit} style={{ height }} />
    </div>
  );
}
