import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Pressable } from "@veloradesk/ui";
import { cloudConfig, signOut } from "@veloradesk/core/cloud-auth";
import { cloudRequest, cloudUsage, type CloudUsage } from "@veloradesk/core/cloud";
import { cloudState } from "./cloud-state";
import { flushEditors } from "./editor-lifecycle";

function bytes(value: number) {
  return `${(value / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`;
}
export default function AccountPanel() {
  const account = useSyncExternalStore(cloudState.subscribe, cloudState.getSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<CloudUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const cancel = useRef<HTMLButtonElement>(null);
  const accountId = account.session?.user.id;
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    void cloudUsage().then(value => { if (active) setUsage(value); })
      .catch(() => { if (active) setUsageError("Storage usage could not be loaded."); })
      .finally(() => { if (active) setUsageLoading(false); });
    return () => { active = false; };
  }, [accountId, refresh]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await action(); } catch { setError("The account action could not be completed. Try again."); } finally { setBusy(false); }
  }
  if (!account.session) return <p>{cloudConfig() ? "Sign in from the sign-in screen to access your account and synced workspace." : "Cloud sign-in is not configured in this build. This workspace runs locally; account storage is available in a configured build."}</p>;
  const email = account.session.user.email ?? "Account";
  return <div className="settings-account">
    <div className="settings-account-profile"><span className="settings-avatar" aria-hidden="true">{email.slice(0, 1).toUpperCase()}</span><div><strong>{email}</strong><p>Your workspace follows your account.</p></div></div>
    <Pressable className="ws-button" disabled={busy} onClick={() => void run(async () => { await flushEditors(); await signOut(); })}>Sign out</Pressable>
    <section className="settings-card" aria-labelledby="storage-heading">
      <div className="settings-row"><h3 id="storage-heading">Storage</h3><Pressable className="ws-button" disabled={usageLoading} onClick={() => { setUsageLoading(true); setUsageError(""); setRefresh(value => value + 1); }}>Refresh storage</Pressable></div>
      {usageLoading && <div className="settings-skeleton" role="status">Loading storage usage…</div>}
      {usageError && <div role="alert"><p>{usageError}</p><Pressable className="ws-button" onClick={() => { setUsageLoading(true); setUsageError(""); setRefresh(value => value + 1); }}>Retry storage</Pressable></div>}
      {!usageLoading && !usageError && usage && <div className="settings-storage">{[
        { label: "Database", value: usage.databaseBytes, limit: usage.databaseLimit },
        { label: "Files", value: usage.storageBytes, limit: usage.storageLimit },
      ].map(item => <label key={item.label}><span className="settings-row"><strong>{item.label}</strong><span>{bytes(item.value)} of {bytes(item.limit)}</span></span><progress aria-label={`${item.label} usage`} max={item.limit || 1} value={item.value} /></label>)}</div>}
    </section>
    <section className="settings-card settings-danger"><h3>Danger zone</h3><p>Permanently delete your account and its cloud data. This cannot be undone.</p>
      <Pressable className="ws-button ws-danger" disabled={busy} onClick={() => { setConfirmation(""); setConfirmOpen(true); }}>Delete account</Pressable>
    </section>
    {error && <p role="alert">{error}</p>}
    <Dialog.Root open={confirmOpen} onOpenChange={open => { if (!busy) setConfirmOpen(open); }}><Dialog.Portal container={document.getElementById("root")}><Dialog.Overlay className="ws-overlay settings-confirm-overlay" /><Dialog.Content role="alertdialog" className="settings-confirm" onOpenAutoFocus={event => { event.preventDefault(); cancel.current?.focus(); }}>
      <Dialog.Title>Delete account?</Dialog.Title><Dialog.Description>Permanently delete your account data. Type DELETE ACCOUNT to confirm.</Dialog.Description>
      <label className="ws-field-label">Confirmation<input className="ws-input" value={confirmation} autoComplete="off" onChange={event => setConfirmation(event.target.value)} /></label>
      <div className="ws-settings-actions"><Dialog.Close asChild><Pressable ref={cancel} className="ws-button" disabled={busy}>Cancel</Pressable></Dialog.Close><Pressable className="ws-button ws-danger" disabled={busy || confirmation !== "DELETE ACCOUNT"} onClick={() => void run(async () => { await flushEditors(); await cloudRequest("/functions/v1/delete-account", {}); await signOut(); setConfirmOpen(false); })}>{busy ? "Deleting…" : "Delete account"}</Pressable></div>
      {error && <p role="alert">{error}</p>}
    </Dialog.Content></Dialog.Portal></Dialog.Root>
  </div>;
}
