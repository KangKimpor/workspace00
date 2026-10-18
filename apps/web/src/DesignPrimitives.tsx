import { useState } from "react";
import { Pressable } from "@veloradesk/ui";
import ActionMenu from "./ActionMenu";
import PropertyTypeIcon from "./PropertyTypeIcon";
import Tag from "./Tag";
import { tagColors } from "./tag-colors";
import "./notion-surfaces.css";

export default function DesignPrimitives() {
  const [tab, setTab] = useState("Table"), [notice, setNotice] = useState("");
  return <div className="design-primitive-grid" aria-label="Workspace primitives">
    <section className="card controls-card"><h3>Actions and menus</h3>
      <div className="button-demo"><Pressable className="button filled" onClick={() => setNotice("Primary action selected")}>Primary</Pressable><Pressable className="button outline" onClick={() => setNotice("Default action selected")}>Default</Pressable><Pressable className="button plain" onClick={() => setNotice("Danger action preview")}>Danger preview</Pressable>
      <ActionMenu label="Preview menu" items={[{ label: "Open", onSelect: () => setNotice("Open selected") }, { label: "Duplicate", onSelect: () => setNotice("Duplicate selected") }]}>Menu</ActionMenu></div>
      <p role="status">{notice || "Actions report their result here."}</p>
    </section>
    <section className="card controls-card"><h3>Properties and tags</h3><div className="design-tag-grid">{tagColors.map(color => <span className="ws-tag" data-color={color} key={color}>{color}</span>)}</div><p><Tag value="In progress" /> <PropertyTypeIcon type="date" /> Property icons use the existing icon library.</p></section>
    <section className="card controls-card"><h3>Fields and tabs</h3><label className="field-label">Page name<input className="text-field" defaultValue="Project handbook" /></label><div className="design-tabs" role="tablist" aria-label="Preview views">{["Table", "Board", "Gallery"].map(name => <Pressable key={name} role="tab" aria-selected={tab === name} tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={event => { if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return; const names = ["Table", "Board", "Gallery"]; const index = names.indexOf(name); const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null; if (next !== null) { event.preventDefault(); setTab(names[next]!); (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus(); } }}>{name}</Pressable>)}</div><p role="tabpanel">{tab} view selected.</p></section>
    <section className="card controls-card"><h3>Feedback and loading</h3><div className="design-banner" role="status">Your changes are saved.</div><div className="design-skeleton" role="status" aria-label="Loading preview" /><div className="design-empty"><p>No items yet.</p><Pressable className="button filled" onClick={() => setNotice("New item action selected")}>New item</Pressable></div></section>
  </div>;
}
