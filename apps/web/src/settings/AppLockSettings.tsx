import { useState } from "react";
import { Pressable } from "@veloradesk/ui";
import { configureAppLock, removeAppLock, hasAppLock } from "../ApplicationLock";

export default function AppLockSettings() {
  const [enabled, setEnabled] = useState(hasAppLock());
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section>
      <h3>App lock</h3>
      <p>
        Hide this app when it opens or stays in the background for five minutes.
        Encrypt individual notes or journal bodies in the editor for protection
        of stored data.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void (
            enabled ? removeAppLock(passphrase) : configureAppLock(passphrase)
          )
            .then(() => {
              setEnabled(!enabled);
              setPassphrase("");
              setMessage(
                enabled
                  ? "App lock removed."
                  : "App lock enabled. Keep your passphrase safe.",
              );
            })
            .catch((error) => setMessage(String(error)))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          App passphrase
          <input
            className="ws-input"
            type="password"
            value={passphrase}
            autoComplete={enabled ? "current-password" : "new-password"}
            minLength={8}
            required
            onChange={(event) => setPassphrase(event.target.value)}
          />
        </label>
        <Pressable
          type="submit"
          className="ws-button ws-tinted"
          disabled={busy}
        >
          {busy ? "Working…" : enabled ? "Remove app lock" : "Enable app lock"}
        </Pressable>
      </form>
      <p role="status">{message}</p>
    </section>
  );
}
