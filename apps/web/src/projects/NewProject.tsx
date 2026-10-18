import { useState } from "react";
import { Pressable } from "@veloradesk/ui";
import { projectPresets, projectPreset, type ProjectType } from "@veloradesk/core/projects";
import { Check } from "../Coolicons";

export const presetIcons:Record<ProjectType,string> = {weekly:"📋",rework:"🛠️",app:"🚀",coursework:"📚",model:"📊"};
export const presetDescriptions:Record<ProjectType,string> = {weekly:"Keep reports, dates and updates together.",rework:"Track issues by area until the work is done.",app:"Move your next build from idea to shipped.",coursework:"Keep assignments, courses and due dates in view.",model:"Track model updates and weekly checks."};
export default function NewProject({initialType="app",onCreate}:{initialType?:ProjectType;onCreate:(type:ProjectType,title:string,icon:string)=>Promise<unknown>}) {
  const [type,setType]=useState(initialType),[title,setTitle]=useState(""),[icon,setIcon]=useState(presetIcons[initialType]),[busy,setBusy]=useState(false);
  return <form className="project-create" onSubmit={event=>{event.preventDefault();if(busy)return;setBusy(true);void onCreate(type,title.trim()||projectPreset(type)!.label,icon).finally(()=>setBusy(false));}}>
    <label className="ws-field-label">Project name<input className="ws-input" aria-label="Project name" data-sheet-autofocus placeholder={projectPreset(type)!.label} value={title} onChange={event=>setTitle(event.target.value)}/></label>
    <fieldset className="project-icon-picker"><legend>Project icon</legend>{[...Object.values(presetIcons),"🎯","💡","🌿"].map(emoji=><Pressable key={emoji} aria-label={`Use ${emoji} icon`} aria-pressed={icon===emoji} onClick={()=>setIcon(emoji)}>{emoji}</Pressable>)}</fieldset>
    <fieldset className="project-preset-picker"><legend>Choose a starting point</legend>{projectPresets.map(preset=><Pressable key={preset.type} className="project-preset" aria-label={preset.label} aria-pressed={type===preset.type} onClick={()=>{setType(preset.type);setIcon(presetIcons[preset.type]);}}><span className="project-preset-icon">{presetIcons[preset.type]}</span><span><strong>{preset.label}</strong><span>{presetDescriptions[preset.type]}</span><small>Includes: {preset.fields.map(field=>field.name).join(" · ")} · {preset.view} view</small></span>{type===preset.type && <Check size={18}/>}</Pressable>)}</fieldset>
    <Pressable className="ws-button ws-filled project-create-submit" type="submit" disabled={busy}>{busy?"Creating…":"Create project"}</Pressable>
  </form>;
}
