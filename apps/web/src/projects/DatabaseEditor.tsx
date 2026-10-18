import { Fragment,useEffect,useRef,useState } from 'react';
import type { DatabaseDefinition,DatabaseView,Filter,FilterGroup,Page,PropertyDefinition,PropertyValue } from '@veloradesk/core/model';
import { store } from '@veloradesk/core/store';
import { completeProjectTask,projectPreset,projectViews,taskDone,taskDue,weekNumber,type ProjectType } from '@veloradesk/core/projects';
import { Pressable } from '@veloradesk/ui';
import { CalendarDays,Check,ChevronDown,ChevronLeft,ChevronRight,Columns3,FileText,LayoutGrid,List,MoreHorizontal,Plus,Search,Table2,Trash2,X } from '../Coolicons';
import ActionMenu from '../ActionMenu';
import { OptionPill, ProjectCard } from '../Today';
import Sheet from '../WorkspaceSheet';
import PageButton from '../PageButton';
import { readSetting,writeSetting,localDate,displayDate,titleOf } from '../page-presentation';
import { registerEditorFlush } from '../editor-lifecycle';
import { requestText,requestConfirmation } from '../WorkspacePrompt';
import PropertyTypeIcon from '../PropertyTypeIcon';
import Tag from '../Tag';
import AddPropertyForm from './AddPropertyForm';
import './projects.css';
function Empty({title,children}:{title:string;children:React.ReactNode}) { return <div className="ws-empty"><h3>{title}</h3><p>{children}</p></div>; }
const viewIcons = {
  table: Table2,
  list: List,
  board: Columns3,
  calendar: CalendarDays,
  gallery: LayoutGrid,
};

function TaskRow({ task, project, definition, onOpen, onComplete, visibleIds }: { task: Page; project?: Page;
  definition?: DatabaseDefinition; onOpen: (id: string) => void; onComplete?: (page: Page) => void; visibleIds?: string[];
}) {
  const [completing, setCompleting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const dateVisible = !visibleIds || definition?.properties.some(property => property.type === "date" && visibleIds.includes(property.id));
  const due = dateVisible ? taskDue(task, definition) : "";
  const status = definition?.properties.find(property => property.type === "status" && (!visibleIds || visibleIds.includes(property.id)));
  return <div className={`ws-task-row${completing ? " completing" : ""}`}>
    {onComplete && <Pressable className="ws-task-check" role="checkbox" aria-checked={completing} aria-label={`Complete ${titleOf(task)}`}
      onClick={() => { if (completing) return; setCompleting(true); timer.current = setTimeout(() => onComplete(task), 200); }}>
      <span>{completing && <Check size={16} />}</span>
    </Pressable>}
    <Pressable className="ws-task-title" onClick={() => onOpen(task.id)}><strong>{titleOf(task)}</strong>
      <small>{[project && titleOf(project), due && displayDate(due), status && task.properties[status.id]].filter(Boolean).join(" · ")}</small>
    </Pressable>
  </div>;
}


export function RowProperties({
  page,
  definition,
  pages,
  onError,
}: {
  page: Page;
  definition?: DatabaseDefinition;
  pages: Page[];
  onError: (message: string) => void;
}) {
  const [adding,setAdding]=useState(false);
  return definition ? (
    <><div className="ws-row-properties">
      {definition.properties
        .filter((property) => property.type !== "title")
        .map((property) => (
          <label key={property.id}>
            <span><PropertyTypeIcon type={property.type}/>{property.name}</span>
            <PropertyInput
              property={property}
              value={page.properties[property.id] ?? null}
              row={page}
              pages={pages}
              onChange={(value) =>
                void store.patchPageProperties(page.id, { [property.id]: value }).catch(cause => onError(String(cause)))
              }
            />
          </label>
        ))}
      <Pressable className="ws-button project-add-row-property" onClick={()=>setAdding(true)}><Plus size={16}/>Add a property</Pressable>
    </div><Sheet open={adding} onOpenChange={setAdding} title="Add property"><AddPropertyForm databaseId={definition.id} databases={store.listDatabases()} pages={pages} onAdded={()=>setAdding(false)} onError={onError}/></Sheet></>
  ) : null;
}

function propertyValue(row: Page, key: string) {
  return key === "title" ? row.title : (row.properties[key] ?? null);
}
function matchesFilter(row: Page, filter: Filter | FilterGroup): boolean {
  if ("children" in filter)
    return filter.operator === "and"
      ? filter.children.every((child) => matchesFilter(row, child))
      : filter.children.some((child) => matchesFilter(row, child));
  const value = propertyValue(row, filter.property);
  if (filter.operator === "empty")
    return (
      value === null || value === "" || (Array.isArray(value) && !value.length)
    );
  const actual = String(value ?? "").toLocaleLowerCase();
  const expected = String(filter.value ?? "").toLocaleLowerCase();
  if (filter.operator === "contains") return actual.includes(expected);
  if (filter.operator === "before") return actual < expected;
  if (filter.operator === "after") return actual > expected;
  return actual === expected;
}
function PropertyInput({
  property,
  value,
  pages,
  onChange,
}: {
  property: PropertyDefinition;
  value: PropertyValue;
  row: Page;
  pages: Page[];
  onChange: (value: PropertyValue) => void;
}) {
  if (property.type === "checkbox")
    return (
      <Pressable
        className="ws-property-check"
        role="checkbox"
        aria-checked={Boolean(value)}
        aria-label={property.name}
        onClick={() => onChange(!value)}
      >
        <span>{value ? <Check size={14} /> : null}</span>
      </Pressable>
    );
  if (property.type === "select" || property.type === "status") return <OptionPill property={property} value={value} onChange={onChange} />;
  if (property.type === "relation")
    return (
      <select
        multiple
        value={Array.isArray(value) ? value : []}
        aria-label={property.name}
        onChange={(event) =>
          onChange(
            [...event.target.selectedOptions].map((option) => option.value),
          )
        }
      >
        {pages
          .filter((page) => page.databaseId === property.relationDatabaseId)
          .map((page) => (
            <option key={page.id} value={page.id}>
              {titleOf(page)}
            </option>
          ))}
      </select>
    );
  if (property.type === "rollup") return <output aria-label={property.name} title="Rollup calculations are not available in phase one">Unavailable</output>;
  if (property.type === "multi-select")
    return (
      <div className="project-multi-select"><ActionMenu label={property.name} items={[...(property.options??[]).map(option=>({label:option,onSelect:()=>onChange((Array.isArray(value)?value:[]).includes(option)?(value as string[]).filter(item=>item!==option):[...(Array.isArray(value)?value:[]),option])})),{label:"Clear",onSelect:()=>onChange([])}]}>{Array.isArray(value)&&value.length?value.map(option=><Tag key={option} value={option}/>):"Select"}</ActionMenu><input
        aria-label={`${property.name} values`}
        placeholder="Separate with commas"
        value={Array.isArray(value) ? value.join(", ") : String(value ?? "")}
        onChange={(event) =>
          onChange(
            event.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
        list={`options-${property.id}`}
      /></div>
    );
  if (property.type === "files") return <span className="ws-files-property">{Array.isArray(value) ? value.join(", ") : ""}<small>Attach files in the item page. This property stores imported file names.</small></span>;
  return (
    <input
      aria-label={property.name}
      placeholder={property.type === "person" ? "Account or email" : undefined}
      type={
        property.type === "number"
          ? "number"
          : property.type === "date"
            ? "date"
            : property.type === "url"
              ? "url"
              : property.type === "email"
                ? "email"
                : property.type === "phone"
                  ? "tel"
                  : "text"
      }
      value={property.type === "date" ? String(value ?? "").slice(0, 10) : String(value ?? "")}
      onChange={(event) =>
        onChange(
          property.type === "number"
            ? event.target.value === ""
              ? null
              : Number(event.target.value)
            : event.target.value,
        )
      }
    />
  );
}

function withoutPropertyFilter(filter: FilterGroup | undefined, property: string): FilterGroup | undefined {
  if (!filter) return undefined;
  return { ...filter, children: filter.children.flatMap<Filter | FilterGroup>(child => "children" in child ? [withoutPropertyFilter(child, property)!] : child.property === property ? [] : [child]) };
}

function PropertySummary({ row, properties }: { row: Page; properties: PropertyDefinition[] }) {
  return <div className="ws-task-secondary">{properties.filter(property => property.type !== "title").map(property => {
    const value = row.properties[property.id];
    if (value == null || value === "") return null;
    return <span key={property.id}>{property.name}: {property.type === "rollup" ? "Unavailable" : typeof value === "boolean" ? value ? "Yes" : "No" : Array.isArray(value) ? value.join(", ") : String(value)}</span>;
  })}</div>;
}

export default function DatabaseEditor({
  definition,
  onPeek,
  project,
  pages,
  databases,
  projectType: type,
  onOpen,
  onError,
}: {
  definition: DatabaseDefinition;
  onPeek?: (id:string) => void;
  project: Page;
  pages: Page[];
  databases: DatabaseDefinition[];
  projectType?: ProjectType;
  onOpen: (id: string) => void;
  onError: (message: string) => void;
}) {
  const preset = projectPreset(type);
  const generic = Boolean(project.properties.__workspaceDatabase);
  const [pendingViews, setPendingViews] = useState<Record<string, Partial<DatabaseView>>>({});
  const [viewSaving, setViewSaving] = useState(0);
  const viewWriteFlight = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => registerEditorFlush(() => viewWriteFlight.current), []);
  const views = (generic ? definition.views : projectViews(definition, type)).map(view => ({ ...view, ...pendingViews[view.id] }));
  useEffect(() => {
    setPendingViews(current => {
      const next = { ...current }; let changed = false;
      for (const [id, patch] of Object.entries(current)) {
        const saved = definition.views.find(view => view.id === id);
        if (!saved) continue;
        const remaining = Object.fromEntries(Object.entries(patch).filter(([key, value]) => JSON.stringify(saved[key as keyof DatabaseView]) !== JSON.stringify(value)));
        if (Object.keys(remaining).length === Object.keys(patch).length) continue;
        changed = true;
        if (Object.keys(remaining).length) next[id] = remaining; else delete next[id];
      }
      return changed ? next : current;
    });
  }, [definition.views]);
  const [viewId, setViewId] = useState(() => readSetting(`kimpor-view-${store.accountId}-${definition.id}`, (generic ? views[0]?.id : views.find(view => view.type === "table")?.id) ?? views[0]?.id ?? ""));
  useEffect(() => { if (views.some(view => view.id === viewId)) writeSetting(`kimpor-view-${store.accountId}-${definition.id}`, viewId); }, [viewId, views, definition.id]);
  const [query, setQuery] = useState("");
  const [searchOpen,setSearchOpen] = useState(false);
  const [collapsedGroups,setCollapsedGroups] = useState<string[]>([]);
  const widthKey=`velora-column-widths-${store.accountId}-${definition.id}`;
  const [columnWidths,setColumnWidths] = useState<Record<string,number>>(()=>{try{const value:unknown=JSON.parse(readSetting(widthKey,"{}"));return value&&typeof value==="object"?Object.fromEntries(Object.entries(value).filter(([,width])=>typeof width==="number"&&width>=80&&width<=800)):{};}catch{return {};}});
  const [newTitle, setNewTitle] = useState("");
  const cellOriginal = useRef<PropertyValue>(null);
  const userProperties = definition.properties.filter(property => property.name.trim().toLowerCase() !== "notion source");
  const [configOpen, setConfigOpen] = useState(false);
  const [configTab,setConfigTab] = useState<"view"|"filter"|"sort"|"properties">("view");
  const [configPosition,setConfigPosition] = useState<{left:number;top:number}>();
  const openConfig=(tab:typeof configTab,element?:HTMLElement)=>{
    setConfigTab(tab);
    const rect=element?.getBoundingClientRect();
    setConfigPosition(rect && (document.getElementById('root')?.clientWidth ?? 0)>=600 ? {left:Math.max(16,Math.min(rect.left,innerWidth-496)),top:Math.max(16,Math.min(rect.bottom+8,innerHeight-Math.min(500,innerHeight*.7)-16))}:undefined);
    setConfigOpen(true);
  };
  const [propertyOpen, setPropertyOpen] = useState(false);
  const view = views.find((item) => item.id === viewId) ??
    views[0] ?? {
      id: "table",
      name: "Table",
      type: "table" as const,
    };
  const visibleIds = view.visibleProperties ?? userProperties.filter(property => !(Array.isArray(project.properties.__hiddenColumns) && project.properties.__hiddenColumns.includes(property.id))).map(property => property.id);
  const visibleFields = userProperties.filter(property => property.type === "title" || visibleIds.includes(property.id));
  const rawRows = pages.filter(
    (page) => page.type === "row" && page.databaseId === definition.id,
  );
  const rows = rawRows
    .filter((row) => (!view.filter || matchesFilter(row, view.filter)) && `${row.title} ${row.properties.__locked ? "" : Object.values(row.properties).join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) => {
      for (const sort of view.sort ?? []) {
        const left = propertyValue(a, sort.property);
        const right = propertyValue(b, sort.property);
        const result =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left ?? "").localeCompare(String(right ?? ""));
        if (result) return sort.direction === "desc" ? -result : result;
      }
      return a.createdAt.localeCompare(b.createdAt);
    });
  const save = async (next: DatabaseDefinition) => {
    try {
      await store.saveDatabase({
        ...next,
        updatedAt: new Date().toISOString(),
      });
    } catch (cause) {
      onError(String(cause));
    }
  };
  const patchView = (patch: Partial<DatabaseView>) => {
    const id = view.id;
    setPendingViews(current => ({ ...current, [id]: { ...current[id], ...patch } }));
    setViewSaving(count => count + 1);
    const write = store.patchDatabaseView(definition.id, id, definition.views.some(item => item.id === id) ? patch : { ...view, ...patch });
    viewWriteFlight.current = Promise.all([viewWriteFlight.current.catch(() => {}), write]).then(() => {});
    void write.catch(cause => {
      setPendingViews(current => ({ ...current, [id]: Object.fromEntries(Object.entries(current[id] ?? {}).filter(([key, value]) => JSON.stringify(patch[key as keyof DatabaseView]) !== JSON.stringify(value))) }));
      onError(String(cause));
    }).finally(() => setViewSaving(count => count - 1));
    void viewWriteFlight.current.catch(() => {});
  };
  const completeRow = (row: Page) => completeProjectTask(store, row, definition);
  const addRow = async (properties: Record<string, PropertyValue> = {}, title = "", open = true) => {
    try {
      const row = await store.createPage("row", title, {
        databaseId: definition.id,
        parentId: definition.id,
        properties: { ...(preset?.type === "rework" ? { item: Math.max(0, ...rawRows.map(row => Number(row.properties.item) || 0)) + 1, status: "Open" } : {}),
          ...(preset?.type === "app" ? { status: "Idea" } : {}), ...properties },
      });
      if (open) onOpen(row.id);
    } catch (cause) {
      onError(String(cause));
    }
  };
  const patchRow = (row: Page, key: string, value: PropertyValue) => void (key === "title" ? store.patchPage(row.id, { title: String(value ?? "") }) : store.patchPageProperties(row.id, { [key]: value })).catch(cause => onError(String(cause)));
  const removeProperty = async (property:PropertyDefinition) => {
    if (!await requestConfirmation({title:`Remove ${property.name}?`,description:"Existing values remain in each row's data export.",confirmLabel:"Remove property",danger:true})) return;
    await save({...definition,properties:definition.properties.filter(item=>item.id!==property.id),defaultProperties:Object.fromEntries(Object.entries(definition.defaultProperties??{}).filter(([id])=>id!==property.id)),views:views.map(view=>({...view,visibleProperties:view.visibleProperties?.filter(id=>id!==property.id),sort:view.sort?.filter(sort=>sort.property!==property.id),groupBy:view.groupBy===property.id?"":view.groupBy,filter:withoutPropertyFilter(view.filter,property.id)}))});
  };
  const columnWidth=(property:PropertyDefinition)=>columnWidths[`${view.id}:${property.id}`]??(property.type==="title"?320:180);
  const resizeColumn=(property:PropertyDefinition,event:React.PointerEvent)=>{
    event.preventDefault(); const start=event.clientX,width=columnWidth(property),key=`${view.id}:${property.id}`;
    let next={...columnWidths};
    const move=(event:PointerEvent)=>{next={...next,[key]:Math.max(80,Math.min(800,width+event.clientX-start))};setColumnWidths(next);};
    const end=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",end);window.removeEventListener("pointercancel",end);writeSetting(widthKey,JSON.stringify(next));};
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",end,{once:true});window.addEventListener("pointercancel",end,{once:true});
  };
  const grouping = view.groupBy === "" ? undefined :
    (preset?.group === "area" ? definition.properties.find(property => /room|area/i.test(property.name)) : undefined) ??
    definition.properties.find((property) => property.id === view.groupBy) ??
    definition.properties.find(
      (property) => property.type === "status" || property.type === "select",
    );
  const groupKey = (row: Page) => preset?.group === "week"
    ? String(row.properties.week ?? (taskDue(row, definition) ? weekNumber(new Date(`${taskDue(row, definition)}T12:00:00`)) : "Anytime"))
    : String(row.properties[grouping?.id ?? ""] ?? "No group");
  const groups = [...new Set([...(preset?.group === "week" ? [] : grouping?.options ?? []), ...rows.map(groupKey)])];
  if (!groups.length) groups.push("No group");
  const dateProperty = definition.properties.find(
    (property) => property.type === "date",
  );
  return (
    <div className="ws-database" onKeyDown={event => {
      if (event.key.toLowerCase() === "n" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.nativeEvent.isComposing && event.keyCode !== 229 && !(event.target as Element).closest('input,textarea,select,[contenteditable="true"]')) { event.preventDefault(); void addRow(); }
    }}>
      <div className="ws-database-toolbar">
        <div className="ws-database-views">
        <div className="ws-view-tabs" role="tablist" aria-label={generic ? "Database views" : "Project views"}>
          {views.map((item, index) => <Pressable key={item.id} id={`project-tab-${item.id}`} role="tab" aria-selected={view.id === item.id} aria-controls="project-view-panel" tabIndex={view.id === item.id ? 0 : -1} onClick={() => setViewId(item.id)} onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            const next = event.key === "ArrowRight" ? (index + 1) % views.length : event.key === "ArrowLeft" ? (index - 1 + views.length) % views.length : event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : null;
            if (next === null) return;
            event.preventDefault(); setViewId(views[next]!.id);
            (event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
          }}>{item.name}</Pressable>)}
        </div>
        <ActionMenu label="Add view" className="ws-icon" items={Object.keys(viewIcons).map(kind => ({label:kind.charAt(0).toUpperCase()+kind.slice(1),onSelect:()=>{
          const id = crypto.randomUUID(); void store.patchDatabaseView(definition.id, id, { id, name: kind.charAt(0).toUpperCase()+kind.slice(1), type: kind as DatabaseView["type"] }).then(() => setViewId(id)).catch(cause => onError(String(cause)));
        }}))}><Plus size={18}/></ActionMenu>
        </div>
        <div className="ws-database-actions" role="toolbar" aria-label={generic ? "Database controls" : "Task controls"}>
          {(searchOpen||query)&&<label className="ws-search-field"><Search size={16} /><input type="search" autoFocus aria-label={generic ? "Search items" : "Search tasks"} placeholder={generic ? "Search items" : "Search tasks"} value={query} onChange={event => setQuery(event.target.value)} /></label>}
          <Pressable className="ws-button ws-db-desktop-tool" onClick={event => openConfig("filter",event.currentTarget)}>Filter</Pressable><Pressable className="ws-button ws-db-mobile-tools" onClick={() => openConfig("view")}>Filter and sort</Pressable>
          <Pressable className="ws-button ws-db-desktop-tool" onClick={event => openConfig("sort",event.currentTarget)}>Sort</Pressable>
          {["board","list","table"].includes(view.type)&&<ActionMenu label="Group items" className="ws-button ws-db-desktop-tool" items={[{label:"None",onSelect:()=>patchView({groupBy:""})},...userProperties.filter(property=>property.type!=="title").map(property=>({label:property.name,onSelect:()=>patchView({groupBy:property.id})}))]}>Group<ChevronDown size={14}/></ActionMenu>}
          <Pressable className="ws-icon" aria-label={generic?"Search database":"Search project"} aria-expanded={searchOpen} onClick={()=>setSearchOpen(!searchOpen)}><Search size={17}/></Pressable>
          <ActionMenu label="View options" className="ws-icon" items={[{label:"Properties",onSelect:()=>openConfig("properties")},{label:"Layout and view settings",onSelect:()=>openConfig("view")},{label:"Rename view",onSelect:()=>void requestText({title:"Rename view",initialValue:view.name}).then(name=>{if(name?.trim())patchView({name:name.trim()});})},{label:"Duplicate view",onSelect:()=>{const id=crypto.randomUUID();void store.patchDatabaseView(definition.id,id,{...view,id,name:`${view.name} copy`}).then(()=>setViewId(id)).catch(cause=>onError(String(cause)));}}]}><MoreHorizontal size={18}/></ActionMenu>
          <Pressable
            className="ws-button ws-filled project-new-action"
            onClick={() => void addRow()}
          >
            <Plus size={16} />
            {generic ? "New item" : "New task"}
          </Pressable>
        </div>
      </div>
      {(view.filter?.children.length||view.sort?.length) ? <div className="project-query-chips" aria-label="Active filters and sorts">{view.filter?.children.map((filter,index)=><Pressable className="ws-button" key={`filter-${index}`} aria-label={`Remove active filter ${index+1}`} onClick={()=>patchView({filter:{...view.filter!,children:view.filter!.children.filter((_,position)=>position!==index)}})}>{"children" in filter?`${filter.children.length} conditions`:`${definition.properties.find(property=>property.id===filter.property)?.name??filter.property} ${filter.operator} ${filter.value??""}`}<X size={14}/></Pressable>)}{view.sort?.map((sort,index)=><Pressable className="ws-button" key={`sort-${index}`} aria-label={`Remove active sort ${index+1}`} onClick={()=>patchView({sort:view.sort?.filter((_,position)=>position!==index)})}>{definition.properties.find(property=>property.id===sort.property)?.name??sort.property} {sort.direction==="asc"?"↑":"↓"}<X size={14}/></Pressable>)}</div>:null}
      <div id="project-view-panel" role="tabpanel" aria-labelledby={`project-tab-${view.id}`} tabIndex={0}>
      <div className="ws-db-count">
        {rows.length} {rows.length === 1 ? "item" : "items"}
        {rows.length !== rawRows.length ? ` of ${rawRows.length}` : ""}
      </div>
      {view.type === "table" && (
        <div className="project-table-region"><div className="ws-db-table-scroll" data-scroll-x tabIndex={0} aria-label="Database table">
          <table className="ws-db-table project-resizable-table" style={{width:visibleFields.reduce((sum,property)=>sum+columnWidth(property),44)}}>
            <colgroup>{visibleFields.map(property=><col key={property.id} style={{width:columnWidth(property)}}/>)}<col style={{width:44}}/></colgroup>
            <thead>
              <tr>
                {visibleFields.map((property) => (
                  <th key={property.id} scope="col" data-type={property.type}>
                    <div className="project-column-heading"><PropertyTypeIcon type={property.type}/><span>{property.name}</span><ActionMenu label={`${property.name} column options`} className="ws-icon" items={[{label:"Rename",onSelect:()=>void requestText({title:"Rename property",initialValue:property.name}).then(name=>{if(name?.trim())void save({...definition,properties:definition.properties.map(item=>item.id===property.id?{...item,name:name.trim()}:item)});})},{label:"Sort ascending",onSelect:()=>patchView({sort:[{property:property.id,direction:"asc"}]})},{label:"Sort descending",onSelect:()=>patchView({sort:[{property:property.id,direction:"desc"}]})},...(property.type!=="title"?[{label:"Hide property",onSelect:()=>patchView({visibleProperties:visibleIds.filter(id=>id!==property.id)})},{label:"Remove property",onSelect:()=>void removeProperty(property)}]:[])]}><MoreHorizontal size={15}/></ActionMenu></div>
                    <span className="project-column-resize" role="separator" aria-label={`Resize ${property.name} column`} aria-orientation="vertical" aria-valuemin={80} aria-valuemax={800} aria-valuenow={columnWidth(property)} tabIndex={0} onPointerDown={event=>resizeColumn(property,event)} onKeyDown={event=>{if(event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)return;if(!["ArrowLeft","ArrowRight"].includes(event.key))return;event.preventDefault();const next={...columnWidths,[`${view.id}:${property.id}`]:Math.max(80,Math.min(800,columnWidth(property)+(event.key==="ArrowRight"?16:-16)))};setColumnWidths(next);writeSetting(widthKey,JSON.stringify(next));}}/>
                  </th>
                ))}
                <th scope="col"><Pressable className="ws-icon" aria-label="Add property" onClick={()=>setPropertyOpen(true)}><Plus size={17}/></Pressable></th>
              </tr>
            </thead>
            <tbody>
              {(view.groupBy?groups:[""]).map(group=><Fragment key={group}>{group&&<tr className="project-table-group"><th colSpan={visibleFields.length+1}><Pressable aria-expanded={!collapsedGroups.includes(group)} onClick={()=>setCollapsedGroups(current=>current.includes(group)?current.filter(item=>item!==group):[...current,group])}><ChevronDown size={16}/>{group}<span>{rows.filter(row=>groupKey(row)===group).length}</span></Pressable></th></tr>}{!collapsedGroups.includes(group)&&rows.filter(row=>!group||groupKey(row)===group).map((row) => (
                <tr key={row.id}>
                  {visibleFields.map((property) => (
                    <td key={property.id} data-type={property.type} onFocusCapture={event => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node)) cellOriginal.current = property.type === "title" ? row.title : row.properties[property.id] ?? null;
                    }} onKeyDown={event => {
                      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); patchRow(row, property.type === "title" ? "title" : property.id, cellOriginal.current); (event.target as HTMLElement).blur(); }
                      if (event.key === "Enter" && (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); event.target.blur(); }
                    }}>
                      {property.type === "title" ? (
                        <div className={`ws-db-title${!generic && taskDone(row, definition) ? " completed" : ""}`}>
                          {!generic && <Pressable className="ws-task-check" role="checkbox" aria-checked={taskDone(row, definition)} aria-label={`Complete ${titleOf(row)}`} onClick={() => void completeRow(row).catch(cause => onError(String(cause)))}><span>{taskDone(row, definition) && <Check size={16} />}</span></Pressable>}
                          <Pressable
                            className="ws-icon"
                            aria-label={`Open ${titleOf(row)}`}
                            onClick={() => (onPeek ?? onOpen)(row.id)}
                          >
                            <FileText size={16} />
                          </Pressable>
                          <input
                            value={row.title}
                            aria-label="Row title"
                            placeholder="Untitled"
                            onChange={(event) =>
                              patchRow(row, "title", event.target.value.replace(/[\r\n]/g, " "))
                            }
                          />
                        </div>
                      ) : (
                        <PropertyInput
                          property={property}
                          value={row.properties[property.id] ?? null}
                          row={row}
                          pages={pages}
                          onChange={(value) =>
                            patchRow(row, property.id, value)
                          }
                        />
                      )}
                    </td>
                  ))}<td/>
                </tr>
              ))}</Fragment>)}
              <tr><td colSpan={visibleFields.length+1}><input className="ws-inline-task" aria-label={generic ? "New item name" : "New task name"} placeholder="+ New" value={newTitle} onChange={event => setNewTitle(event.target.value)} onKeyDown={event => {
                if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                if (event.key === "Escape") { event.preventDefault(); setNewTitle(""); }
                if (event.key === "Enter" && newTitle.trim()) { event.preventDefault(); void addRow({}, newTitle.trim(), false); setNewTitle(""); }
              }} /></td></tr>
            </tbody>
          </table>
        </div><footer className="project-table-footer">{rows.length===rawRows.length?`${rows.length} items`:`${rows.length} of ${rawRows.length} items`}</footer></div>
      )}
      {view.type === "list" && generic && <div className="ws-db-list">{rows.map(row => <div className="ws-project-task" key={row.id}><PageButton page={row} onOpen={onOpen} small /><PropertySummary row={row} properties={visibleFields} /></div>)}</div>}
      {view.type === "list" && !generic && (
        <div className="ws-db-list">
          {((preset?.group === "area" || preset?.group === "week" || grouping?.type === "status") ? groups : [""]).filter(group => rows.some(row => !taskDone(row, definition) && (!group || groupKey(row) === group))).map(group => <section className="ws-db-list-group" key={group}>
            {group && <h3>{preset?.group === "week" && group !== "Anytime" ? `Week ${group}` : group}</h3>}
            {rows.filter(row => !taskDone(row, definition) && (!group || groupKey(row) === group)).map(row => <div className="ws-project-task" key={row.id}>
              <TaskRow task={row} definition={definition} visibleIds={visibleIds} onOpen={onOpen} onComplete={row => void completeRow(row).catch(cause => onError(String(cause)))} />
              <div className="ws-task-secondary">{visibleFields.filter(property => property.type !== "title" && property.type !== "status" && property.type !== "date").map(property => <span key={property.id}>{row.properties[property.id] == null ? null : `${property.name} ${String(row.properties[property.id])}`}</span>)}</div>
            </div>)}
          </section>)}
          {rows.some(row => taskDone(row, definition)) && <details className="ws-done-tasks"><summary>Done</summary>{rows.filter(row => taskDone(row, definition)).map(row => <TaskRow key={row.id} task={row} definition={definition} visibleIds={visibleIds} onOpen={onOpen} />)}</details>}
        </div>
      )}
      {view.type === "board" && (
        <div className="ws-db-board">
          {groups.map((group) => (
            <section
              className="ws-board-column"
              key={group}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/veloradesk-row");
                const row = rows.find((item) => item.id === id);
                if (row && grouping)
                  patchRow(
                    row,
                    grouping.id,
                    group === "No group" ? null : group,
                  );
              }}
            >
              <h3>
                {group}
                <span className="ws-count">
                  {
                    rows.filter(
                      (row) =>
                        String(
                          row.properties[grouping?.id ?? ""] ?? "No group",
                        ) === group,
                    ).length
                  }
                </span>
              </h3>
              {rows
                .filter(
                  (row) =>
                    String(row.properties[grouping?.id ?? ""] ?? "No group") ===
                    group,
                )
                .map((row) => (
                  <article
                    key={row.id}
                    draggable
                    onDragStartCapture={(event) =>
                      event.dataTransfer.setData("text/veloradesk-row", row.id)
                    }
                    className="ws-board-card"
                  >
                    <Pressable className="project-board-open" onClick={()=>(onPeek??onOpen)(row.id)}><strong>{titleOf(row)}</strong><PropertySummary row={row} properties={visibleFields}/></Pressable>
                    {grouping&&<ActionMenu label={`Move ${titleOf(row)} to`} className="ws-button project-board-move" items={groups.map(target=>({label:target,onSelect:()=>patchRow(row,grouping.id,target==="No group"?null:target)}))}>Move to…<ChevronDown size={13}/></ActionMenu>}
                  </article>
                ))}
              <Pressable
                className="ws-button"
                onClick={() =>
                  void addRow(
                    grouping
                      ? { [grouping.id]: group === "No group" ? null : group }
                      : {},
                  )
                }
              >
                <Plus size={16} />
                {generic ? "Add item" : "Add task"}
              </Pressable>
            </section>
          ))}
        </div>
      )}
      {view.type === "gallery" && (
        <div className="ws-db-gallery">
          {rows.map((row) => (
            <ProjectCard key={row.id} project={row} pages={[]} onOpen={onPeek??onOpen} rowSummary={<PropertySummary row={row} properties={visibleFields}/>}/>
          ))}
        </div>
      )}
      {view.type === "calendar" &&
        (dateProperty ? (
          <DatabaseCalendar
            rows={rows}
            dateProperty={dateProperty.id}
            properties={visibleFields}
            onOpen={onOpen}
            onAdd={(date) => void addRow({ [dateProperty.id]: date })}
          />
        ) : (
          <Empty title="Choose a date property">
            Add a Date property to place rows on your calendar.
          </Empty>
        ))}
      {!rows.length && view.type !== "calendar" && (
        <Empty title="A fresh database">
          Add a row. Each item is a page with its own notes.
        </Empty>
      )}
      </div>
      <Sheet
        open={configOpen}
        onOpenChange={open => { if (open) setConfigOpen(true); else void viewWriteFlight.current.then(() => setConfigOpen(false)).catch(cause => onError(String(cause))); }}
        title={configTab === "view" ? "View settings" : configTab === "filter" ? generic ? "Filter items" : "Filter tasks" : configTab === "sort" ? generic ? "Sort items" : "Sort tasks" : "Visible properties"}
        popoverPosition={configPosition}
      >
        <p className="ws-help" role="status">{viewSaving ? "Saving view…" : "View saved"}</p>
        {configTab === "view" && <>
        <label className="ws-field-label">
          View name
          <input
            className="ws-input"
            value={view.name}
            onChange={(event) => patchView({ name: event.target.value })}
          />
        </label>
        <label className="ws-field-label">
          View type
          <select
            className="ws-input"
            value={view.type}
            onChange={(event) =>
              patchView({ type: event.target.value as DatabaseView["type"] })
            }
          >
            {Object.keys(viewIcons).map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="ws-field-label">
          Group by
          <select
            className="ws-input"
            value={view.groupBy ?? ""}
            onChange={(event) => patchView({ groupBy: event.target.value })}
          >
            <option value="">None</option>
            {definition.properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </label>
        </>}
        {(configTab === "view" || configTab === "properties") && <>
        <Pressable className="ws-button" onClick={() => setPropertyOpen(true)}>Add property</Pressable>
        <h3>Visible properties</h3>
        {userProperties.filter(property => property.type !== "title").map(property => <label className="ws-column-control" key={property.id}><input type="checkbox" checked={visibleIds.includes(property.id)} onChange={event => patchView({ visibleProperties: event.target.checked ? [...visibleIds, property.id] : visibleIds.filter(id => id !== property.id) })} />{property.name}</label>)}
        {!view.id.startsWith("presentation:") && <Pressable className="ws-button ws-danger" disabled={views.length < 2 || (!generic && view.type === "table" && views.filter(item => item.type === "table").length < 2)} onClick={() => { void store.deleteDatabaseView(definition.id, view.id).catch(cause => onError(String(cause))); setViewId(views.find(item => item.id !== view.id)!.id); setConfigOpen(false); }}>Delete view</Pressable>}
        </>}
        {(configTab === "view" || configTab === "filter") && <>
        <h3>Filters</h3>
        <FilterEditor
          filter={view.filter ?? { operator: "and", children: [] }}
          properties={definition.properties}
          onChange={(filter) => patchView({ filter })}
        />
        </>}
        {(configTab === "view" || configTab === "sort") && <>
        <h3>Sort</h3>
        {view.sort?.map((sort, index) => (
          <div className="ws-filter-row" key={index}>
            <select
              value={sort.property}
              aria-label="Sort property"
              onChange={(event) =>
                patchView({
                  sort: view.sort?.map((item, position) =>
                    position === index
                      ? { ...item, property: event.target.value }
                      : item,
                  ),
                })
              }
            >
              {definition.properties.map((property) => (
                <option value={property.id} key={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
            <select
              value={sort.direction}
              aria-label="Sort direction"
              onChange={(event) =>
                patchView({
                  sort: view.sort?.map((item, position) =>
                    position === index
                      ? {
                          ...item,
                          direction: event.target.value as "asc" | "desc",
                        }
                      : item,
                  ),
                })
              }
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
            <Pressable
              className="ws-icon"
              aria-label="Remove sort"
              onClick={() =>
                patchView({
                  sort: view.sort?.filter((_, position) => position !== index),
                })
              }
            >
              <X size={16} />
            </Pressable>
          </div>
        ))}
        <Pressable
          className="ws-button ws-tinted"
          onClick={() =>
            patchView({
              sort: [
                ...(view.sort ?? []),
                { property: "title", direction: "asc" },
              ],
            })
          }
        >
          <Plus size={16} />
          Add sort
        </Pressable>
        <Pressable
          className="ws-button"
          onClick={() => {
            const id = crypto.randomUUID();
            void store.patchDatabaseView(definition.id, id, { ...view, id, name: `${view.name} copy` }).then(() => setViewId(id)).catch(cause => onError(String(cause)));
          }}
        >
          Duplicate saved view
        </Pressable>
        </>}
      </Sheet>
      <Sheet
        open={propertyOpen}
        onOpenChange={setPropertyOpen}
        title="Database properties"
      >
        <div className="ws-property-list">
          {definition.properties.map((property) => (
            <div className="ws-trash-row" key={property.id}>
              <span>
                <strong>{property.name}</strong>
                <small>{property.type}</small>
              </span>
              {property.type !== "title" && (
                <Pressable
                  className="ws-icon ws-danger"
                  aria-label={`Remove ${property.name} property`}
                  onClick={() => void removeProperty(property)}
                >
                  <Trash2 size={16} />
                </Pressable>
              )}
            </div>
          ))}
        </div>
        <details><summary>New item defaults</summary><p className="ws-help">Applied to newly created items. Existing items keep their values.</p>{definition.properties.filter(property => !["title", "relation", "rollup", "files"].includes(property.type)).map(property => <label className="ws-field-label" key={property.id}>{property.name}<PropertyInput property={property} value={definition.defaultProperties?.[property.id] ?? null} row={project} pages={pages} onChange={value => void save({ ...definition, defaultProperties: { ...definition.defaultProperties, [property.id]: value } })} /></label>)}</details>
        <AddPropertyForm databaseId={definition.id} databases={databases} pages={pages} onAdded={()=>setPropertyOpen(false)} onError={onError}/>
      </Sheet>
    </div>
  );
}

function FilterEditor({
  filter,
  properties,
  onChange,
  depth = 0,
}: {
  filter: FilterGroup;
  properties: PropertyDefinition[];
  onChange: (filter: FilterGroup) => void;
  depth?: number;
}) {
  return (
    <div className="ws-filter-group">
      <select
        aria-label="Filter combination"
        value={filter.operator}
        onChange={(event) =>
          onChange({ ...filter, operator: event.target.value as "and" | "or" })
        }
      >
        <option value="and">Match all (AND)</option>
        <option value="or">Match any (OR)</option>
      </select>
      {filter.children.map((child, index) => (
        <div className="ws-filter-child" key={index}>
          {"children" in child ? (
            <FilterEditor
              filter={child}
              properties={properties}
              depth={depth + 1}
              onChange={(next) =>
                onChange({
                  ...filter,
                  children: filter.children.map((item, position) =>
                    position === index ? next : item,
                  ),
                })
              }
            />
          ) : (
            <div className="ws-filter-row">
              <select
                value={child.property}
                aria-label="Filter property"
                onChange={(event) =>
                  onChange({
                    ...filter,
                    children: filter.children.map((item, position) =>
                      position === index
                        ? { ...child, property: event.target.value }
                        : item,
                    ),
                  })
                }
              >
                {properties.map((property) => (
                  <option value={property.id} key={property.id}>
                    {property.name}
                  </option>
                ))}
              </select>
              <select
                value={child.operator}
                aria-label="Filter condition"
                onChange={(event) =>
                  onChange({
                    ...filter,
                    children: filter.children.map((item, position) =>
                      position === index
                        ? {
                            ...child,
                            operator: event.target.value as Filter["operator"],
                          }
                        : item,
                    ),
                  })
                }
              >
                {["contains", "equals", "before", "after", "empty"].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
              {child.operator !== "empty" && (
                <input
                  aria-label="Filter value"
                  value={String(child.value ?? "")}
                  onChange={(event) =>
                    onChange({
                      ...filter,
                      children: filter.children.map((item, position) =>
                        position === index
                          ? { ...child, value: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              )}
            </div>
          )}
          <Pressable
            className="ws-icon ws-filter-remove"
            aria-label="Remove filter"
            onClick={() =>
              onChange({
                ...filter,
                children: filter.children.filter(
                  (_, position) => position !== index,
                ),
              })
            }
          >
            <X size={16} />
          </Pressable>
        </div>
      ))}
      <div className="ws-filter-add">
        <Pressable
          className="ws-button"
          onClick={() =>
            onChange({
              ...filter,
              children: [
                ...filter.children,
                {
                  property: properties[0]?.id ?? "title",
                  operator: "contains",
                  value: "",
                },
              ],
            })
          }
        >
          <Plus size={14} />
          Rule
        </Pressable>
        {depth < 5 && (
          <Pressable
            className="ws-button"
            onClick={() =>
              onChange({
                ...filter,
                children: [
                  ...filter.children,
                  { operator: "or", children: [] },
                ],
              })
            }
          >
            <Plus size={14} />
            Group
          </Pressable>
        )}
      </div>
    </div>
  );
}

function DatabaseCalendar({
  rows,
  dateProperty,
  properties,
  onOpen,
  onAdd,
}: {
  rows: Page[];
  dateProperty: string;
  properties: PropertyDefinition[];
  onOpen: (id: string) => void;
  onAdd: (date: string) => void;
}) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const start = new Date(month);
  start.setDate(1 - start.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
  return (
    <div>
      <div className="ws-db-calendar-heading">
        <Pressable
          className="ws-icon"
          aria-label="Previous month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          <ChevronLeft size={18} />
        </Pressable>
        <h3>
          {month.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </h3>
        <Pressable
          className="ws-icon"
          aria-label="Next month"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          <ChevronRight size={18} />
        </Pressable>
      </div>
      <div className="ws-db-calendar">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <strong key={day}>{day}</strong>
        ))}
        {days.map((date) => (
          <div
            className={`ws-db-day ${date.getMonth() !== month.getMonth() ? "outside" : ""} ${localDate(date)===localDate()?"today":""}`}
            key={localDate(date)}
          >
            <Pressable
              className="ws-day-number"
              aria-label={`Add item on ${date.toLocaleDateString()}`}
              onClick={() => onAdd(localDate(date))}
            >
              {date.getDate()}
            </Pressable>
            {rows
              .filter((row) => row.properties[dateProperty] === localDate(date))
              .map((row) => (
                <Pressable
                  className="ws-db-event"
                  key={row.id}
                  onClick={() => onOpen(row.id)}
                >
                  {titleOf(row)}<PropertySummary row={row} properties={properties} />
                </Pressable>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

