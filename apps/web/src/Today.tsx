import { useEffect, useRef, useState, type ReactNode } from "react";
import ActionMenu from "./ActionMenu";
import { ArrowUpRight, Check, ChevronDown, MoreHorizontal, Plus } from "./Coolicons";

import { Pressable } from "@veloradesk/ui";
import type { CalendarEvent, DatabaseDefinition, Page, PropertyDefinition, PropertyValue } from "@veloradesk/core/model";
import { store } from "@veloradesk/core/store";
import { projectPreset, projectType, taskDone, taskDue, type ProjectTypes } from "@veloradesk/core/projects";
import "./today.css";
import Tag from "./Tag";

const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const title = (page: Page) => page.properties.__locked ? "Locked entry" : page.title || "Untitled";
const time = (value: string | Date) => new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
export function statusClass(value: string) {
  return /^(done|shipped|completed?)$/i.test(value) ? "done" : /^(in progress|doing|building|testing|redo|review)$/i.test(value) ? "active" : /^(blocked|stuck|overdue)$/i.test(value) ? "blocked" : "neutral";
}
export function OptionPill({ property, value, onChange }: { property: PropertyDefinition; value: PropertyValue; onChange: (value: PropertyValue) => void }) {
  const label = String(value || "Not started");
  return <ActionMenu label={property.name} className={`ws-status-pill ${statusClass(label)}`} items={["", ...property.options ?? []].map(option => ({label:option || "Clear",onSelect:()=>onChange(option || null)}))}><Tag value={label}/><ChevronDown size={14} /></ActionMenu>;
}
export function ProjectCard({ project, pages, definition, types = {}, onOpen, onRename,onDuplicate,onTrash,compact=false,rowSummary }: { project: Page; pages: Page[]; definition?: DatabaseDefinition; types?: ProjectTypes; onOpen: (id: string) => void;onRename?:()=>void;onDuplicate?:()=>void;onTrash?:()=>void;compact?:boolean;rowSummary?:ReactNode }) {
  const tasks = pages.filter(page => page.databaseId === project.id && page.type === "row");
  const done = tasks.filter(task => taskDone(task, definition)).length;
  const next = tasks.filter(task => !taskDone(task, definition)).map(task => taskDue(task, definition)).filter((due): due is string => !!due).sort()[0];
  const type=projectType(project,types), cover=["blue","purple","warm"].includes(project.cover)?project.cover:type==="app"?"blue":type==="coursework"||type==="model"?"purple":"warm";
  const items=[{label:"Open",onSelect:()=>onOpen(project.id)},...(onRename?[{label:"Rename",onSelect:onRename}]:[]),...(onDuplicate?[{label:"Duplicate",onSelect:onDuplicate}]:[]),...(onTrash?[{label:"Move to Trash",onSelect:onTrash}]:[])];
  return <article className={`ws-project-card${compact?" compact":""}`}><span className={`project-card-cover ${cover}`} aria-hidden="true"/><Pressable className="project-card-open" onClick={() => onOpen(project.id)} aria-label={`Open ${title(project)}`}><span className="project-card-content"><span className="project-card-icon" aria-hidden="true">{project.icon||"📁"}</span><strong>{title(project)}</strong>{project.type!=="row"&&<Tag value={projectPreset(type)?.label ?? "Project"}/>}<span className="project-progress" hidden={project.type==="row"}><span role="progressbar" aria-label={`${title(project)} progress`} aria-valuemin={0} aria-valuemax={tasks.length||1} aria-valuenow={done}><span style={{width:`${tasks.length?100*done/tasks.length:0}%`}}/></span><small>{done}/{tasks.length}</small></span>{next&&<time dateTime={next} className={next<dateKey()?"project-overdue":""}>Due {new Date(`${next}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</time>}{rowSummary}</span></Pressable><div className="project-card-menu"><ActionMenu label={`Project options for ${title(project)}`} className="ws-icon" items={items}><MoreHorizontal size={18}/></ActionMenu></div></article>;
}
export function TaskCard({ task, project, definition, next, onOpen, onComplete }: { task: Page; project?: Page; definition?: DatabaseDefinition; next?: boolean; onOpen: (id: string) => void; onComplete: (page: Page) => void }) {
  const [completing, setCompleting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const due = taskDue(task, definition), done = taskDone(task, definition);
  const status = definition?.properties.find(property => property.type === "status");
  return <article className={`ws-task-card${next ? " next" : ""}${done ? " done" : ""}${completing ? " completing" : ""}`}>
    <div className="ws-task-card-meta"><span>{project ? title(project) : "Task"}</span>{due && <time dateTime={due} className={due < dateKey() && !done ? "ws-danger" : ""}>{due}</time>}</div>
    <Pressable className="ws-task-title" onClick={() => onOpen(task.id)}><strong>{title(task)}</strong></Pressable>
    <footer>{status ? <OptionPill property={status} value={task.properties[status.id] ?? null} onChange={value => void store.patchPageProperties(task.id, { [status.id]: value }).catch(cause => window.dispatchEvent(new CustomEvent("velora-appearance-error", { detail: String(cause) })))} /> : <span>{done ? "Done" : "Not started"}</span>}
      <Pressable className="ws-task-check" role="checkbox" aria-checked={done || completing} aria-label={`${done ? "Reopen" : "Complete"} ${title(task)}`} disabled={completing} onClick={() => { setCompleting(true); timer.current = setTimeout(() => { onComplete(task); setCompleting(false); }, 200); }}><span>{(done || completing) && <Check size={16} />}</span></Pressable>
      <Pressable className="ws-icon" aria-label={`Open ${title(task)}`} onClick={() => onOpen(task.id)}><ArrowUpRight size={18} /></Pressable></footer>
  </article>;
}
export default function Today({ pages, events, databases, types = {}, onOpen, onCapture, onCalendar, onComplete }: { pages: Page[]; events: CalendarEvent[]; databases: DatabaseDefinition[]; types?: ProjectTypes; onOpen:(id:string)=>void; onCapture:()=>void; onCalendar:(day?:string)=>void; onComplete:(page:Page)=>void }) {
  const [now,setNow] = useState(() => new Date()), [filter,setFilter] = useState("All"), [projectFilter,setProjectFilter] = useState("All");
  useEffect(() => { const timer = setInterval(() => setNow(new Date()),60000); return () => clearInterval(timer); },[]);
  const today = dateKey(now), definitions = new Map(databases.map(definition => [definition.id,definition]));
  const [expanded, setExpanded] = useState<CalendarEvent[] | null>(null);
  useEffect(() => {
    let active = true;
    setExpanded(null);
    if (events.some(event => event.recurrence)) {
      const start = new Date(`${today}T00:00:00`), end = new Date(start); end.setDate(end.getDate()+1);
      void import("@veloradesk/integrations").then(({expandEvents}) => {
        const entries = expandEvents(events.filter(event => !event.deletedAt),start.toISOString(),end.toISOString());
        if (active) setExpanded(entries.map(occurrence => ({...occurrence.event,id:occurrence.key,start:occurrence.start,end:occurrence.end})));
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [events,today]);
  const projects = pages.filter(page => page.type === "database" && !page.properties.__workspaceDatabase);
  const projectIds = new Set(projects.map(project => project.id));
  const tasks = pages.filter(page => page.type === "row" && (!page.databaseId || projectIds.has(page.databaseId)));
  const done = tasks.filter(task => taskDone(task,definitions.get(task.databaseId ?? ""))), open = tasks.filter(task => !done.includes(task));
  const due = (task:Page) => taskDue(task,definitions.get(task.databaseId ?? ""));
  const groups: Record<string,Page[]> = { All:open, Today:open.filter(task => due(task) === today), Overdue:open.filter(task => !!due(task) && due(task)! < today), Upcoming:open.filter(task => !!due(task) && due(task)! > today), Anytime:open.filter(task => !due(task)), Done:done };
  const next = groups.Today![0] ?? [...open].filter(task => due(task)).sort((a,b)=>due(a)!.localeCompare(due(b)!))[0];
  const start = new Date(now); start.setHours(0,0,0,0); const end = new Date(start); end.setDate(end.getDate()+1);
  const dailyEvents = (expanded ?? events.filter(event => !event.deletedAt && (event.allDay ? event.start.slice(0,10) <= today && event.end.slice(0,10) > today : new Date(event.start) < end && new Date(event.end) > start))).sort((a,b) => a.start.localeCompare(b.start));
  const projectKinds = [...new Set(projects.map(project=>projectType(project,types)).filter(Boolean))];
  return <div className="ws-today ws-task-today">
    <header className="ws-today-hero"><div><h1>Today</h1><p className="ws-eyebrow">{now.toLocaleDateString(undefined,{ weekday:"long",day:"numeric",month:"long" })}</p></div><Pressable className="ws-button ws-filled" onClick={onCapture}><Plus size={18} />New task</Pressable><div className="ws-today-stats" aria-label="Workspace overview"><span><strong>{open.length}</strong>Open</span><span><strong>{done.length}</strong>Done</span><span className={groups.Overdue!.length ? "overdue" : ""}><strong>{groups.Overdue!.length}</strong>Overdue</span></div></header>
    {!!projects.length && <section className="ws-project-section" aria-label="Projects"><div className="ws-section-title"><h2>Projects <span>{projects.length}</span></h2><div className="ws-filter-chips" aria-label="Project types">{["All",...projectKinds].map(kind=><Pressable key={kind} aria-pressed={projectFilter === kind} onClick={()=>setProjectFilter(kind!)}>{kind === "All" ? kind : projectPreset(kind)?.label}</Pressable>)}</div></div><div className="ws-project-strip" data-scroll-x tabIndex={0}>{projects.filter(project=>projectFilter === "All" || projectType(project,types) === projectFilter).map(project=><ProjectCard key={project.id} project={project} pages={pages} definition={definitions.get(project.id)} types={types} onOpen={onOpen} />)}</div></section>}
    <section aria-label="Tasks"><div className="ws-section-title"><h2>Today’s tasks <span>{tasks.length}</span></h2><div className="ws-filter-chips" aria-label="Task filters">{Object.entries(groups).map(([name,items])=><Pressable key={name} aria-pressed={filter === name} onClick={()=>setFilter(name)}>{name} <span>{items.length}</span></Pressable>)}</div></div><div className="ws-task-grid">{groups[filter]!.map(task=><TaskCard key={task.id} task={task} project={projects.find(project=>project.id === task.databaseId)} definition={definitions.get(task.databaseId ?? "")} next={next?.id === task.id} onOpen={onOpen} onComplete={onComplete} />)}</div>{!groups[filter]!.length && <div className="ws-quiet-empty"><Check size={28} /><Pressable className="ws-button ws-tinted" onClick={onCapture}>Add task</Pressable></div>}</section>
    {!!dailyEvents.length && <section className="ws-card ws-agenda-card" aria-label="Agenda"><h2>Agenda</h2>{dailyEvents.map(event=><div className="ws-agenda-row" key={event.id}><time>{event.allDay ? "All day" : time(event.start)}</time><span className="ws-event-dot" /><span><strong>{event.title || "Untitled"}</strong><small>{event.location}</small></span><Pressable className="ws-icon" aria-label={`Open ${event.title}`} onClick={()=>event.pageId ? onOpen(event.pageId) : onCalendar(dateKey(now))}><ArrowUpRight size={18} /></Pressable></div>)}</section>}
  </div>;
}
