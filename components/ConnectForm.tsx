import { ActionForm } from '@/components/ActionForm';
import type { FormState } from '@/app/app/actions';

type Values = { id?: string; name?: string; base_url?: string; client_id?: string; tenant?: string };

/** Halo connection fields. On edit, a blank secret keeps the saved one. */
export function ConnectForm({ action, values, submit }: { action: (s: FormState, f: FormData) => Promise<FormState>; values?: Values; submit: string }) {
  const editing = Boolean(values?.id);
  return (
    <ActionForm action={action} submit={submit} pending={editing ? 'Testing and saving' : 'Connecting'}>
      {values?.id ? <input type="hidden" name="instance_id" value={values.id} /> : null}
      <div className="field-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" placeholder="Acme test" required maxLength={80} defaultValue={values?.name} />
        </div>
        <div className="field">
          <label htmlFor="base_url">Halo address</label>
          <input id="base_url" name="base_url" placeholder="acme.haloitsm.com" required defaultValue={values?.base_url?.replace(/^https:\/\//, '')} />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="client_id">Client ID</label>
          <input id="client_id" name="client_id" required autoComplete="off" defaultValue={values?.client_id} />
        </div>
        <div className="field">
          <label htmlFor="client_secret">Client secret</label>
          <input id="client_secret" name="client_secret" type="password" required={!editing} autoComplete="new-password" placeholder={editing ? 'Leave blank to keep the saved secret' : undefined} />
          <span className="hint">Stored encrypted, never shown again.</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor="tenant">Tenant <span className="hint">(optional, only for hosted Halo with a tenant name)</span></label>
        <input id="tenant" name="tenant" autoComplete="off" defaultValue={values?.tenant} />
      </div>
    </ActionForm>
  );
}
