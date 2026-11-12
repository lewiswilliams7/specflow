'use client';

import { useState } from 'react';

/** Founder-only: run the current learning round on the trial and download the results to attach in Claude. */
export function LearnPanel({ trial, round }: { trial: { id: string; name: string } | null; round: number }) {
  const [apply, setApply] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const run = async () => {
    if (!trial) return;
    setBusy(true);
    setMsg('Running. This takes a few minutes; keep this page open.');
    try {
      const res = await fetch('/api/admin/learn', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ instance_id: trial.id, apply }) });
      const text = await res.text();
      if (!res.ok) {
        setMsg((() => { try { return JSON.parse(text).error; } catch { return `Failed (${res.status}).`; } })());
        return;
      }
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `SEND-TO-CLAUDE-${round}.txt` });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg('Done. The results file has downloaded: attach it in the chat with Claude.');
    } catch (e) {
      setMsg(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="learn-h">
      <div className="card-head">
        <div>
          <h2 id="learn-h">Learning round {round}</h2>
          <p>Only you see this. It runs on your trial only, makes &ldquo;zz Enact sample&rdquo; records and never deletes.</p>
        </div>
      </div>
      <div className="card-body">
        {trial ? (
          <>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} disabled={busy} />
              <span>Make the zz samples on {trial.name} (untick to read only)</span>
            </label>
            <div>
              <button className="btn btn-primary" type="button" onClick={run} disabled={busy}>{busy ? 'Running…' : `Run round ${round}`}</button>
            </div>
          </>
        ) : (
          <p className="muted">No trial instance in this workspace. Trials allowed: gethandoveruk.haloitsm.com, halotrialconcord.trial.usehalo.com. It&apos;s locked to that instance, so it can never run on a client&apos;s.</p>
        )}
        {msg ? <p className="subtle" role="status">{msg}</p> : null}
      </div>
    </section>
  );
}
