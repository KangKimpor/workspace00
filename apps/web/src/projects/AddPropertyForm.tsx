import { useState } from "react";
import { Pressable } from "@veloradesk/ui";
import type { DatabaseDefinition, Page, PropertyDefinition } from "@veloradesk/core/model";
import { store } from "@veloradesk/core/store";
import { flushEditors } from "../editor-lifecycle";

const propertyTypes:PropertyDefinition["type"][]=["text","number","select","multi-select","status","date","checkbox","url","email","phone","relation","person"];
export default function AddPropertyForm({databaseId,databases,pages,onAdded,onError}:{databaseId:string;databases:DatabaseDefinition[];pages:Page[];onAdded:()=>void;onError:(message:string)=>void}) {
  const [name,setName]=useState(""),[type,setType]=useState<PropertyDefinition["type"]>("text"),[options,setOptions]=useState(""),[related,setRelated]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const submit=async()=>{
    if(busy||!name.trim())return;
    const owner=store.accountId;
    setBusy(true);setError("");
    try {
      await flushEditors();
      await store.refreshSnapshot();
      if(owner!==store.accountId)throw new Error("Workspace account changed");
      const current=store.listDatabases().find(database=>database.id===databaseId);
      if(!current)throw new Error("Database no longer exists");
      const property:PropertyDefinition={id:crypto.randomUUID(),name:name.trim(),type,...(["select","multi-select","status"].includes(type)?{options:options.split(",").map(value=>value.trim()).filter(Boolean)}:{}),...(type==="relation"?{relationDatabaseId:related}: {})};
      await store.saveDatabase({...current,properties:[...current.properties,property]});
      onAdded();
    }catch(cause){const message=String(cause);setError(message);onError(message);}finally{setBusy(false);}
  };
  return <form onSubmit={event=>{event.preventDefault();void submit();}}>
    <label className="ws-field-label">Property name<input className="ws-input" data-sheet-autofocus required value={name} onChange={event=>setName(event.target.value)}/></label>
    <label className="ws-field-label">Type<select className="ws-input" value={type} onChange={event=>setType(event.target.value as PropertyDefinition["type"])}>{propertyTypes.map(value=><option key={value}>{value}</option>)}</select></label>
    {["select","multi-select","status"].includes(type)&&<label className="ws-field-label">Options (separate with commas)<input className="ws-input" value={options} onChange={event=>setOptions(event.target.value)}/></label>}
    {type==="relation"&&<label className="ws-field-label">Related database<select className="ws-input" required value={related} onChange={event=>setRelated(event.target.value)}><option value="">Choose a database</option>{databases.filter(database=>database.id!==databaseId).map(database=><option key={database.id} value={database.id}>{pages.find(page=>page.id===database.id)?.title||"Untitled database"}</option>)}</select></label>}
    <p className="ws-help">Person fields store an account/email. Attach files in page content. Rollup calculations are not available in phase one.</p>
    {error&&<p role="alert">{error}</p>}
    <Pressable className="ws-button ws-filled" type="submit" disabled={busy}>{busy?"Adding…":"Add property"}</Pressable>
  </form>;
}
