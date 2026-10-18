import { lazy, Suspense, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { BrandMark, Pressable } from "@veloradesk/ui";
import { CalendarDays, ChevronLeft, ChevronRight, Download, LockKeyhole, Monitor, Palette, Search, Settings, Trash2, X } from "../Coolicons";
import { useWorkspaceSize } from "../WorkspaceChrome";
import { flushEditors } from "../editor-lifecycle";
import { saveAppearance } from "../appearance";
import { disablePush, enablePush, getPushState, type PushState } from "../notifications";
import { version } from "../../package.json";
import notices from "../../../../THIRD-PARTY-NOTICES.md?raw";
import "./settings.css";

const AccountPanel = lazy(() => import("../AccountPanel"));
const ImportExportPanel = lazy(() => import("../ImportExportPanel"));
const AppLockSettings = lazy(() => import("./AppLockSettings"));
const InstallSettings = lazy(() => import("../InstallSettings"));
const groups = [
  { title: "Account", items: [{ id: "account", title: "My account", keywords: "email storage sign out delete account", icon: Settings }] },
  { title: "Preferences", items: [
    { id: "appearance", title: "Appearance", keywords: "theme light dark system accent color density compact reduce motion", icon: Palette },
    { id: "region", title: "Language & region", keywords: "language timezone time zone device", icon: Settings },
    { id: "notifications", title: "Notifications", keywords: "push background reminders permission", icon: Settings },
  ] },
  { title: "Privacy & data", items: [
    { id: "lock", title: "App lock", keywords: "passphrase password privacy security", icon: LockKeyhole },
    { id: "import", title: "Import & export", keywords: "backup json markdown csv zip files", icon: Download },
    { id: "trash", title: "Trash", keywords: "restore deleted pages", icon: Trash2 },
  ] },
  { title: "Workspace", items: [
    { id: "calendars", title: "Calendars", keywords: "calendar accounts providers sync", icon: CalendarDays },
    { id: "devices", title: "Devices & install", keywords: "pwa home screen iphone ipad browser install", icon: Monitor },
  ] },
  { title: "Help", items: [
    { id: "shortcuts", title: "Keyboard shortcuts", keywords: "search commands undo focus keys", icon: Settings },
    { id: "about", title: "About", keywords: "version licenses kimpor workspace", icon: Settings },
  ] },
];
const items = groups.flatMap(group => group.items);
function read(key: string, fallback: string) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } }
function Appearance() {
  const [, update] = useState(0);
  useEffect(() => { const changed = () => update(value => value + 1); window.addEventListener("velora-appearance", changed); return () => window.removeEventListener("velora-appearance", changed); }, []);
  const theme = read("velora-theme", "light"), accent = read("velora-accent", "blue"), density = read("velora-density", "comfortable"), reduce = read("velora-reduce-motion", "false") === "true";
  return <div className="settings-stack">
    <section><h3>Theme</h3><p className="settings-help">Choose how your workspace looks.</p><div className="settings-themes">{["light", "dark", "system"].map(value => <Pressable key={value} className="settings-theme" aria-pressed={theme === value} onClick={() => saveAppearance("velora-theme", value)}>
      <span className="settings-theme-preview" data-preview={value} aria-hidden="true"><span /><span><i /><i /><i /></span></span><span>{value[0]?.toUpperCase()}{value.slice(1)}</span>
    </Pressable>)}</div></section>
    <section><h3>Accent</h3><p className="settings-help">Used for primary actions, links and focus rings.</p><div className="settings-swatches" role="group" aria-label="Accent">{["blue", "green", "red", "purple", "orange", "lime"].map(value => <Pressable key={value} className="settings-swatch" data-swatch={value} aria-label={`${value[0]?.toUpperCase()}${value.slice(1)} accent`} aria-pressed={accent === value} onClick={() => saveAppearance("velora-accent", value)}><span /></Pressable>)}</div></section>
    <section><h3>Density</h3><div className="ws-segment" role="group" aria-label="Density">{["comfortable", "compact"].map(value => <Pressable key={value} className={value === density ? "selected" : ""} aria-pressed={value === density} onClick={() => saveAppearance("velora-density", value)}>{value === "compact" ? "Compact" : "Comfortable"}</Pressable>)}</div></section>
    <div className="settings-row"><div><h3>Reduce motion</h3><p className="settings-help" id="settings-motion-help">Minimize transitions and animations.</p></div><Pressable className="settings-switch" role="switch" aria-label="Reduce motion" aria-describedby="settings-motion-help" aria-checked={reduce} onClick={() => saveAppearance("velora-reduce-motion", String(!reduce))}><span /></Pressable></div>
  </div>;
}
function Notifications({ onNotify, onError }: { onNotify: (message: string) => void; onError: (message: string) => void }) {
  const [state, setState] = useState<PushState | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => void getPushState().then(value => { if (active) setState(value); }).catch(() => { if (active) setState({ enabled: false, available: false, message: "Notification status could not be read. Reopen this section to try again." }); });
    refresh(); window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, []);
  return <><div className="settings-row"><strong>Background notifications</strong><Pressable className="settings-switch" role="switch" aria-label="Background notifications" aria-describedby="settings-push-status" aria-checked={state?.enabled ?? false} disabled={busy || !state?.available} onClick={() => {
    setBusy(true);
    void (async () => { if (state?.enabled) { await disablePush(); onNotify("Background notifications disabled."); } else onNotify(await enablePush()); })()
      .catch(error => onError(String(error))).finally(() => { void getPushState().then(setState).catch(error => onError(String(error))).finally(() => setBusy(false)); });
  }}><span /></Pressable></div><p id="settings-push-status" role="status">{busy ? "Updating notifications…" : state?.message ?? "Checking notification status…"}</p><p className="settings-help">In-app reminders work while your workspace is open.</p></>;
}
export interface SettingsDialogProps {
  open: boolean; onOpenChange: (open: boolean) => void;
  onNotify: (message: string) => void; onError: (message: string) => void;
  onTrash: () => void; onCalendars: () => void; trashCount: number;
}
export default function SettingsDialog({ open, onOpenChange, onNotify, onError, onTrash, onCalendars, trashCount }: SettingsDialogProps) {
  const { phone } = useWorkspaceSize();
  const [active, setActive] = useState("account"), [detail, setDetail] = useState(false), [query, setQuery] = useState("");
  const heading = useRef<HTMLHeadingElement>(null), nav = useRef<HTMLElement>(null), swipe = useRef<number | null>(null);
  const returnFocus = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const title = items.find(item => item.id === active)?.title ?? "My account";
  const close = () => { void flushEditors().then(() => { onOpenChange(false); setDetail(false); setQuery(""); }).catch(error => onError(String(error))); };
  const select = (id: string) => { setActive(id); setDetail(true); requestAnimationFrame(() => heading.current?.focus()); };
  const back = () => { setDetail(false); requestAnimationFrame(() => nav.current?.querySelector<HTMLButtonElement>(`[data-setting="${active}"]`)?.focus()); };
  const handoff = (action: () => void) => { void flushEditors().then(() => { onOpenChange(false); action(); }).catch(error => onError(String(error))); };
  const modifier = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
  return <Dialog.Root open={open} onOpenChange={next => { if (!next) close(); else onOpenChange(true); }}><Dialog.Portal container={document.getElementById("root")}><Dialog.Overlay className="ws-overlay" /><Dialog.Content className="settings-dialog" data-phone={phone} data-detail={detail} onCloseAutoFocus={event => { event.preventDefault(); const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Settings"]'); if (trigger?.getClientRects().length) trigger.focus(); else if (returnFocus.current?.isConnected) returnFocus.current.focus(); }} onEscapeKeyDown={event => { if (phone && detail) { event.preventDefault(); back(); } }} onPointerDown={event => { if (phone && detail && event.pointerType === "touch" && event.clientX < 32) swipe.current = event.clientX; }} onPointerCancel={() => { swipe.current = null; }} onPointerUp={event => { if (swipe.current !== null && event.clientX - swipe.current > 80) back(); swipe.current = null; }}>
    <div className="settings-topbar">{phone && detail && <Pressable className="ws-icon" aria-label="Back to settings" onClick={back}><ChevronLeft size={20} /></Pressable>}<Dialog.Title>Settings</Dialog.Title><Pressable className="ws-icon settings-close" aria-label="Close Settings" onClick={close}><X size={20} /></Pressable></div>
    <Dialog.Description className="ws-sr-only">Manage your account, preferences and workspace.</Dialog.Description>
    <div className="settings-layout"><nav ref={nav} className="settings-nav" aria-label="Settings categories" hidden={phone && detail}>
      <label className="settings-search"><Search size={17} /><input type="search" placeholder="Search settings" aria-label="Search settings" value={query} onChange={event => setQuery(event.target.value)} /></label>
      {groups.map(group => { const filtered = group.items.filter(item => `${item.title} ${item.keywords}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())); return filtered.length ? <div className="settings-nav-group" key={group.title}><h3>{group.title}</h3>{filtered.map(item => <Pressable key={item.id} className="settings-nav-item" data-setting={item.id} aria-current={!phone && active === item.id ? "page" : undefined} onClick={() => select(item.id)}><item.icon size={18} /><span>{item.title}</span>{item.id === "trash" && <span className="settings-count">{trashCount}</span>}{phone && <ChevronRight size={16} />}</Pressable>)}</div> : null; })}
      {!items.some(item => `${item.title} ${item.keywords}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && <p role="status">No settings found.</p>}
    </nav><section className="settings-content" aria-label={title} hidden={phone && !detail}>
      <h2 tabIndex={-1} ref={heading}>{title}</h2><Suspense fallback={<p role="status">Loading settings…</p>}>
        {active === "account" && <AccountPanel />}
        {active === "appearance" && <Appearance />}
        {active === "region" && <><p className="settings-help">Language and region follow your device.</p><dl className="settings-regions"><div><dt>Language</dt><dd>{navigator.language}</dd></div><div><dt>Time zone</dt><dd>{Intl.DateTimeFormat().resolvedOptions().timeZone}</dd></div></dl></>}
        {active === "notifications" && <Notifications onNotify={onNotify} onError={onError} />}
        {active === "lock" && <AppLockSettings />}
        {active === "import" && <ImportExportPanel onNotify={onNotify} onError={onError} />}
        {active === "trash" && <><p>{trashCount} deleted {trashCount === 1 ? "page" : "pages"}. Restore pages or manage deleted items.</p><Pressable className="ws-button" onClick={() => handoff(onTrash)}>Open Trash</Pressable></>}
        {active === "calendars" && <><p>Manage connected accounts, calendar visibility and sync in Calendar settings.</p><Pressable className="ws-button" onClick={() => handoff(onCalendars)}>Open calendar settings</Pressable></>}
        {active === "devices" && <><InstallSettings /><h3>Install on iPhone or iPad</h3><ol><li>Open this workspace in Safari.</li><li>Choose Share.</li><li>Choose Add to Home Screen, then Add.</li></ol></>}
        {active === "shortcuts" && <table className="settings-shortcuts"><thead><tr><th>Action</th><th>Shortcut</th></tr></thead><tbody>{[["Search / command palette", `${modifier} K`], ["New task", `${modifier} N`], ["Leave focus mode", "Esc"], ["Undo in editor", `${modifier} Z`], ["Editor commands", "/"], ["Calendar day / week / month / agenda", "D / W / M / A"], ["Calendar today", "T"]].map(([action, shortcut]) => <tr key={action}><td>{action}</td><td><kbd>{shortcut}</kbd></td></tr>)}</tbody></table>}
        {active === "about" && <><div className="settings-account-profile"><BrandMark /><div><strong>Kimpor Workspace</strong><p>Version {version}</p></div></div><details className="settings-notices"><summary>Third-party licenses</summary><pre>{notices}</pre></details></>}
      </Suspense>
    </section></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
