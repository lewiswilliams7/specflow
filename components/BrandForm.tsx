'use client';

import { useActionState, useEffect, useState } from 'react';
import { type FormState, saveBranding } from '@/app/app/actions';
import { EmailPreview } from '@/components/EmailPreview';
import { brandedEmail, brandProblems } from '@/lib/specflow/build/email-brand';
import { site } from '@/lib/site';

type Values = { name: string; colour: string; logo: string; footer: string };

const SAMPLE_BODY = 'Hello $USERNAME,\n\nThanks for your request: $symptom.\n\nWe’ve logged it as ticket $FAULTID and the team will be in touch soon.\n\nThe Service Desk';

/** Logo, colour and footer for the emails the builder writes and the sign-off reports, with a live preview. */
export function BrandForm({ instanceId, initial, live }: { instanceId: string; initial: Values; live: boolean }) {
  const [state, run, busy] = useActionState<FormState, FormData>(saveBranding, {});
  const [v, setV] = useState<Values>(initial);
  const [upload, setUpload] = useState<string>('');
  const [removeLogo, setRemoveLogo] = useState(false);
  useEffect(() => () => { if (upload) URL.revokeObjectURL(upload); }, [upload]);

  const hex = /^#[0-9a-f]{6}$/i.test(v.colour) ? v.colour : '#1652f0';
  const logo = removeLogo ? undefined : upload || v.logo || undefined;
  const html = brandedEmail(SAMPLE_BODY, { name: v.name || 'Your service desk', colour: hex, logo_url: logo, footer: v.footer || undefined });
  const problems = v.colour ? brandProblems({ colour: v.colour, logo_url: upload ? undefined : v.logo || undefined, footer: v.footer }) : [];

  return (
    <div className="brand-grid">
      <form action={run} className="card-body" encType="multipart/form-data">
        <input type="hidden" name="instance_id" value={instanceId} />
        <div className="field">
          <label htmlFor="brand_name">Organisation name</label>
          <input id="brand_name" name="brand_name" value={v.name} maxLength={80} placeholder="Northwind IT" onChange={(e) => setV({ ...v, name: e.target.value })} />
          <span className="hint">Used as the logo’s alt text, and in the footer if you leave it empty.</span>
        </div>

        <div className="field">
          <label htmlFor="brand_colour">Brand colour</label>
          <div className="colour-row">
            <input type="color" aria-label="Pick a colour" value={hex} onChange={(e) => setV({ ...v, colour: e.target.value })} />
            <input id="brand_colour" name="brand_colour" value={v.colour} placeholder="#1652F0" maxLength={7} spellCheck={false} onChange={(e) => setV({ ...v, colour: e.target.value.trim() })} />
          </div>
          <span className="hint">A hex code from the client’s brand guidelines, like #0F766E.</span>
        </div>

        <div className="field">
          <label htmlFor="logo">Logo</label>
          <input id="logo" name="logo" type="file" accept="image/png,image/jpeg" onChange={(e) => {
            const f = e.target.files?.[0];
            setUpload(f ? URL.createObjectURL(f) : '');
            if (f) setRemoveLogo(false);
          }} />
          <span className="hint">PNG or JPG, up to 512 KB. Around 480 × 96 pixels looks sharp. Email clients don’t show SVG.</span>
          <details className="or-url">
            <summary>Or use a logo address</summary>
            <input name="brand_logo_url" value={v.logo} placeholder="https://www.example.com/logo.png" onChange={(e) => setV({ ...v, logo: e.target.value.trim() })} />
          </details>
          {v.logo || upload ? (
            <label className="check"><input type="checkbox" name="remove_logo" checked={removeLogo} onChange={(e) => setRemoveLogo(e.target.checked)} /> Remove the logo</label>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="brand_footer">Footer</label>
          <textarea id="brand_footer" name="brand_footer" value={v.footer} maxLength={300} rows={3} placeholder={'Northwind IT Service Desk · 0121 000 0000\nReference $FAULTID'} onChange={(e) => setV({ ...v, footer: e.target.value })} />
          <span className="hint">One or two lines. Halo variables such as $FAULTID work here.</span>
        </div>

        {problems.length ? <p className="notice error" role="alert">{problems[0][0].toUpperCase() + problems[0].slice(1)}.</p> : null}
        <div>
          <button className="btn btn-primary" type="submit" disabled={busy || problems.length > 0}>
            {busy ? <span className="spinner" aria-hidden="true" /> : null}
            {busy ? 'Saving' : 'Save branding'}
          </button>
        </div>
        {state.error ? <p className="notice error" role="alert">{state.error}</p> : null}
        {state.ok ? <p className="notice ok" role="status">{state.ok}</p> : null}
      </form>

      <div className="brand-preview">
        <div className="brand-preview-head">
          <b>Preview</b>
          <span className={`badge ${live ? 'add' : ''}`}>{live ? `Used on every email ${site.name} builds` : 'Switches on once proven on Halo'}</span>
        </div>
        <EmailPreview subject="Your request $FAULTID has been logged" html={html} />
        {!live ? <p className="subtle">We’re checking on a real Halo instance that Halo keeps this layout exactly. Until then, emails go out as plain paragraphs, and your branding is saved ready.</p> : null}
      </div>
    </div>
  );
}
