import { useState, useSyncExternalStore } from "react";
import { Pressable } from "@veloradesk/ui";
import Sheet from "./WorkspaceSheet";

type Prompt = { title:string; label?:string; description?:string; initialValue?:string; confirmLabel?:string; danger?:boolean; text:boolean; resolve:(value:string|null)=>void };
const queue: Prompt[] = [], listeners = new Set<()=>void>();
const notify = () => listeners.forEach(listener => listener());
const subscribe = (listener:()=>void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function requestText(options:{title:string;label?:string;initialValue?:string;confirmLabel?:string}):Promise<string|null> {
  return new Promise(resolve => { queue.push({...options,text:true,resolve}); notify(); });
}
export async function requestConfirmation(options:{title:string;description:string;confirmLabel?:string;danger?:boolean}):Promise<boolean> {
  return await new Promise<string|null>(resolve => { queue.push({...options,text:false,resolve}); notify(); }) !== null;
}
function PromptForm({prompt,onDone}:{prompt:Prompt;onDone:(value:string|null)=>void}) {
  const [value,setValue] = useState(prompt.initialValue ?? "");
  return <form onSubmit={event => { event.preventDefault(); onDone(prompt.text ? value : "confirmed"); }}>
    {prompt.description && <p>{prompt.description}</p>}
    {prompt.text && <label className="ws-field-label">{prompt.label ?? prompt.title}<input className="ws-input" data-sheet-autofocus value={value} onChange={event=>setValue(event.target.value)} /></label>}
    <div className="ws-confirm-actions"><Pressable className="ws-button" data-sheet-autofocus={!prompt.text || undefined} onClick={()=>onDone(null)}>Cancel</Pressable><Pressable className={`ws-button ${prompt.danger ? "ws-danger" : "ws-filled"}`} type="submit">{prompt.confirmLabel ?? (prompt.text ? "Save" : "Confirm")}</Pressable></div>
  </form>;
}
export default function WorkspacePrompt() {
  const prompt = useSyncExternalStore(subscribe,()=>queue[0],()=>undefined);
  const finish = (value:string|null) => { const current=queue.shift(); current?.resolve(value); notify(); };
  return <Sheet open={!!prompt} onOpenChange={open=>{if(!open)finish(null);}} title={prompt?.title ?? "Confirm"} alert={!!prompt && !prompt.text}>{prompt && <PromptForm key={prompt.title} prompt={prompt} onDone={finish}/>}</Sheet>;
}
