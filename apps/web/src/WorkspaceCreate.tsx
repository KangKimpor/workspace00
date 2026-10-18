import { useState } from "react";
import { Pressable } from "@veloradesk/ui";
import type { DatabaseView, Page, PropertyDefinition } from "@veloradesk/core/model";

export type WorkspaceCreateInput = { kind: "page" | "database"; title: string; parentId: string | null; template: string; properties: PropertyDefinition[]; view: DatabaseView["type"] };
export const pageStarters: Record<string, string> = {
  blank: "",
  meeting: "## Agenda\n\n- Topics to discuss\n\n## Notes\n\n## Decisions\n\n## Next steps\n\n- [ ] Follow up",
  brief: "## Goal\n\nWhat are we trying to achieve?\n\n## Context\n\n## Scope\n\n## Success criteria\n\n- [ ] Define the outcome",
};
const schemas: Record<string, PropertyDefinition[]> = {
  blank: [],
  reading: [{ id: "author", name: "Author", type: "text" }, { id: "status", name: "Status", type: "status", options: ["To read", "Reading", "Finished"] }, { id: "url", name: "Link", type: "url" }],
  contacts: [{ id: "email", name: "Email", type: "email" }, { id: "company", name: "Company", type: "text" }, { id: "contact", name: "Contact", type: "person" }],
};
export default function WorkspaceCreate({ kind, pages, onCreate }: { kind: "page" | "database"; pages: Page[]; onCreate: (input: WorkspaceCreateInput) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState("");
  const [template, setTemplate] = useState("blank");
  const [properties, setProperties] = useState<PropertyDefinition[]>([]);
  const [view, setView] = useState<DatabaseView["type"]>("table");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <form className="ws-create-form" onSubmit={async event => {
    event.preventDefault(); if (busy || !title.trim()) return;
    setBusy(true); setError("");
    try { await onCreate({ kind, title: title.trim(), parentId: parentId || null, template, properties, view }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create. Try again."); }
    finally { setBusy(false); }
  }}>
    <label className="ws-field-label">{kind === "page" ? "Page name" : "Database name"}<input autoFocus required className="ws-input" value={title} onChange={event => setTitle(event.target.value)} /></label>
    <label className="ws-field-label">Inside<select className="ws-input" value={parentId} onChange={event => setParentId(event.target.value)}><option value="">Projects root</option>{pages.filter(page => page.type === "page").map(page => <option key={page.id} value={page.id}>{page.title || "Untitled"}</option>)}</select></label>
    <label className="ws-field-label">Template<select className="ws-input" value={template} onChange={event => { setTemplate(event.target.value); if (kind === "database") setProperties((schemas[event.target.value] ?? []).map(property => ({ ...property }))); }}>
      <option value="blank">Blank</option>{kind === "page" ? <><option value="meeting">Meeting notes</option><option value="brief">Project brief</option>{pages.filter(page => page.type === "page" && page.properties.__template).map(page => <option key={page.id} value={page.id}>{page.title || "Untitled template"}</option>)}</> : <><option value="reading">Reading list</option><option value="contacts">Contacts</option></>}
    </select></label>
    {kind === "database" && <>
      <label className="ws-field-label">First view<select className="ws-input" value={view} onChange={event => setView(event.target.value as DatabaseView["type"])}>{["table", "list", "board", "calendar", "gallery"].map(type => <option key={type}>{type}</option>)}</select></label>
      <h3>Properties</h3><p className="ws-help">Every item has a Name and its own page. Add more properties now or later.</p>
      {properties.map((property, index) => <div className="ws-create-property" key={property.id}>
        <input className="ws-input" aria-label={`Property ${index + 1} name`} required value={property.name} onChange={event => setProperties(old => old.map((item, position) => position === index ? { ...item, name: event.target.value } : item))} />
        <select className="ws-input" aria-label={`Property ${index + 1} type`} value={property.type} onChange={event => setProperties(old => old.map((item, position) => position === index ? { ...item, type: event.target.value as PropertyDefinition["type"] } : item))}>{["text", "number", "select", "multi-select", "status", "date", "checkbox", "person", "url", "email", "phone"].map(type => <option key={type}>{type}</option>)}</select>
        <Pressable className="ws-button" aria-label={`Remove property ${index + 1}`} onClick={() => setProperties(old => old.filter((_, position) => position !== index))}>Remove</Pressable>
        {["select", "multi-select", "status"].includes(property.type) && <input className="ws-input" aria-label={`Property ${index + 1} options`} placeholder="Options, separated by commas" value={property.options?.join(", ") ?? ""} onChange={event => setProperties(old => old.map((item, position) => position === index ? { ...item, options: event.target.value.split(",").map(value => value.trim()) } : item))} />}
      </div>)}
      <Pressable className="ws-button" onClick={() => setProperties(old => [...old, { id: crypto.randomUUID(), name: "", type: "text" }])}>Add property</Pressable>
    </>}
    {error && <p role="alert">{error}</p>}
    <Pressable type="submit" className="ws-button ws-filled" disabled={busy || !title.trim()}>{busy ? "Creating…" : `Create ${kind}`}</Pressable>
  </form>;
}
