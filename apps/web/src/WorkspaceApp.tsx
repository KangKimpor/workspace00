import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode, RefObject } from "react";
import ActionMenu from "./ActionMenu";
import WorkspaceCreate, { pageStarters, type WorkspaceCreateInput } from "./WorkspaceCreate";
import * as Dialog from "@radix-ui/react-dialog";
import { BookOpen, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Columns3, FileText, Folder, Home, LayoutGrid, List, Menu, MoreHorizontal, Plus, PenLine, PanelLeftClose, PanelLeftOpen, Search, Settings, Star, Trash2, X } from "./Coolicons";

import { BrandMark, Pressable } from "@veloradesk/ui";
import { EdgeBack, useCollapsingTitle, useKeyboardViewport, useWorkspaceSize } from "./WorkspaceChrome";
import { SyncRetry } from "./AccountGate";
import type {
  CalendarEvent,
  DatabaseDefinition,
  Page,
  PageType,
} from "@veloradesk/core/model";
import { store, trashRoots } from "@veloradesk/core/store";
import { completeProjectTask, inferProjectTypes, projectPreset, projectDefinition, projectType, weekNumber, type ProjectType, type ProjectTypes } from "@veloradesk/core/projects";
import { compareOrder, orderBetween } from "@veloradesk/core/order";
import { startAppearance } from "./appearance";
import { platform } from "@veloradesk/core/platform";
import "./workspace.css";
import "./pages-databases.css";
import Sheet from "./WorkspaceSheet";
import PageButton from "./PageButton";
import "./projects/projects.css";
import "./notion-surfaces.css";
import WorkspacePrompt, { requestText, requestConfirmation } from "./WorkspacePrompt";
const ProjectsHome = lazy(() => import("./projects/ProjectsHome"));
const NewProject = lazy(() => import("./projects/NewProject"));
const DatabaseEditor = lazy(() => import("./projects/DatabaseEditor"));
const RowProperties = lazy(() => import("./projects/DatabaseEditor").then(module => ({ default: module.RowProperties })));
const SettingsDialog = lazy(() => import("./settings/SettingsDialog"));
import { flushEditors, registerEditorFlush } from "./editor-lifecycle";
import { startReminders } from "./notifications";
import { LocalSearch } from "./search";
import Today, { ProjectCard } from "./Today";
import TrashPanel from "./TrashPanel";
import { cloudState } from "./cloud-state";
import { SupabaseTransport } from "@veloradesk/core/cloud";
import AppUpdateNotice from "./AppUpdateNotice";

const RichTextEditor = lazy(() => import("./RichTextEditor"));
const CalendarModule = lazy(() => import("./CalendarWithSettings"));
type Module = "Today" | "Calendar" | "Notes" | "Journal" | "Projects";
type Toast = { message: string; undo?: () => Promise<void> };
const modules: { name: Module; icon: typeof Home }[] = [
  { name: "Today", icon: Home },
  { name: "Projects", icon: LayoutGrid },
  { name: "Calendar", icon: CalendarDays },
  { name: "Notes", icon: FileText },
  { name: "Journal", icon: BookOpen },
 ];
const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const displayDate = (value: string) =>
  new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
const icons = [
  "📄",
  "📓",
  "🌿",
  "💡",
  "✨",
  "📌",
  "🎯",
  "📚",
  "🏡",
  "🪴",
  "🗂️",
  "📝",
];
const titleOf = (page: Page) =>
  page.properties.__locked ? "Locked entry" : page.title || "Untitled";
const pageIcon = (page: Page) =>
  page.icon ||
  (page.type === "journal" ? "📓" : page.type === "database" ? "▦" : "📄");
const moodNames = ["Difficult", "Low", "Okay", "Good", "Great"];
const readSetting = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const writeSetting = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Settings remain available for this session. */
  }
};

function Loading() {
  return (
    <div className="ws-loading" role="status">
      <span className="ws-skeleton" />
      <span className="ws-skeleton" />
      <span className="ws-skeleton short" />
    </div>
  );
}
function Empty({ title, action }: { title: string; children: ReactNode; action?: ReactNode; }) {
  return <div className="ws-empty" aria-label={title}><FileText size={32} />{action ?? <Pressable className="ws-button" onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))}>Done</Pressable>}</div>;
}
function useWindowedRange(
  ref: RefObject<HTMLDivElement | null>,
  count: number,
  estimatedHeight: number,
  enabled = count > 100,
) {
  const [range, setRange] = useState({ start: 0, end: Math.min(count, 40), height: estimatedHeight });
  useLayoutEffect(() => {
    if (!enabled || !ref.current) return;
    const element = ref.current;
    let frame = 0;
    let observedRow: Element | null = null;
    const measure = () => {
      frame = 0;
      const row = element.firstElementChild;
      if (row !== observedRow) {
        if (observedRow) observer.unobserve(observedRow);
        if (row) observer.observe(row);
        observedRow = row;
      }
      const height = row instanceof HTMLElement ? (row.getBoundingClientRect().height + (parseFloat(getComputedStyle(row).marginBottom) || 0)) || estimatedHeight : estimatedHeight;
      const top = element.getBoundingClientRect().top;
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const start = Math.min(count, Math.max(0, Math.floor(-top / height) - 12));
      const end = Math.min(count, Math.max(start, Math.ceil((viewport - top) / height) + 12));
      setRange(previous => previous.start === start && previous.end === end && previous.height === height
        ? previous : { start, end, height });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [ref, count, estimatedHeight, enabled]);
  return enabled ? {
    start: range.start, end: range.end, height: range.height, windowed: true,
    style: {
      height: count * range.height,
      position: "relative" as const,
      overflowAnchor: "none" as const,
    },
  } : { start: 0, end: count, height: estimatedHeight, windowed: false, style: undefined };
}
function PageList({ pages, onOpen, gallery }: { pages: Page[]; onOpen: (id: string) => void; gallery: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const journals = pages.length > 0 && pages.every(page => page.type === "journal");
  const range = useWindowedRange(ref, pages.length, journals ? 120 : 80, !gallery && pages.length > 100);
  return <div ref={ref} className={`ws-page-list ${gallery ? "gallery" : ""} ${journals ? "ws-journal-entries" : ""}`} style={range.style}>
    {pages.slice(range.start, range.end).map((page, index) => <PageButton key={page.id} page={page} onOpen={onOpen}
      style={range.windowed ? { position: "absolute", top: (range.start + index) * range.height, left: 0 } : undefined} />)}
  </div>;
}
function Tree({ pages, onOpen, onMove, selected, sort = "manual" }: {
  pages: Page[];
  onOpen: (id: string) => void;
  onMove: (id: string, parentId: string | null, after?: string | null) => void;
  selected: string | null;
  sort?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => {
    const result = new Map<string | null, Page[]>();
    for (const page of pages) {
      if (page.type === "row" || page.type === "journal") continue;
      const siblings = result.get(page.parentId) ?? [];
      siblings.push(page);
      result.set(page.parentId, siblings);
    }
    for (const siblings of result.values()) siblings.sort((a, b) => sort === "title" ? titleOf(a).localeCompare(titleOf(b)) : sort === "updated" ? b.updatedAt.localeCompare(a.updatedAt) : sort === "created" ? b.createdAt.localeCompare(a.createdAt) : compareOrder(a.properties.__order, b.properties.__order) || a.createdAt.localeCompare(b.createdAt));
    return result;
  }, [pages, sort]);
  const rows = useMemo(() => {
    const result: { page: Page; depth: number }[] = [];
    const stack = [...(groups.get(null) ?? [])].reverse().map(page => ({ page, depth: 0 }));
    const visited = new Set<string>();
    while (stack.length) {
      const row = stack.pop()!;
      if (visited.has(row.page.id)) continue;
      visited.add(row.page.id);
      result.push(row);
      if (expanded.has(row.page.id)) {
        for (const page of [...(groups.get(row.page.id) ?? [])].reverse()) stack.push({ page, depth: row.depth + 1 });
      }
    }
    return result;
  }, [groups, expanded]);
  const range = useWindowedRange(ref, rows.length, 44);
  return <div ref={ref} className="ws-tree" role="tree" style={range.style}>
    {rows.slice(range.start, range.end).map(({ page, depth }, rowIndex) => {
      const siblings = groups.get(page.parentId) ?? [];
      const index = siblings.findIndex(item => item.id === page.id);
      const hasChildren = !!groups.get(page.id)?.length;
      return <div key={page.id} role="treeitem" aria-level={depth + 1}
        style={range.windowed ? { position: "absolute", top: (range.start + rowIndex) * range.height, left: 0, right: 0 } : undefined}
        aria-posinset={index + 1} aria-setsize={siblings.length}
        aria-selected={selected === page.id} aria-expanded={hasChildren ? expanded.has(page.id) : undefined}
        onDragOver={event => { event.preventDefault(); event.stopPropagation(); }}
        onDrop={event => {
          event.preventDefault(); event.stopPropagation();
          const id = event.dataTransfer.getData("text/veloradesk-page");
          if (!id) return;
          const bounds = event.currentTarget.querySelector(".ws-tree-row")?.getBoundingClientRect();
          const position = bounds ? (event.clientY - bounds.top) / bounds.height : 0.5;
          if (position < 0.25) onMove(id, page.parentId, siblings[index - 1]?.id ?? null);
          else if (position > 0.75) onMove(id, page.parentId, page.id);
          else onMove(id, page.id);
        }}>
        <div className="ws-tree-row" style={{ paddingInlineStart: `calc(var(--space-2) + ${depth} * var(--space-3))` }}>
          <Pressable className="ws-icon" disabled={!hasChildren}
            aria-label={`${expanded.has(page.id) ? "Collapse" : "Expand"} ${titleOf(page)}`}
            onClick={() => setExpanded(old => {
              const next = new Set(old);
              if (next.has(page.id)) next.delete(page.id); else next.add(page.id);
              return next;
            })}>
            {expanded.has(page.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </Pressable>
          <Pressable className={`ws-tree-page ${selected === page.id ? "selected" : ""}`} draggable
            onDragStartCapture={event => event.dataTransfer.setData("text/veloradesk-page", page.id)}
            onClick={() => onOpen(page.id)}>
            <span>{titleOf(page)}</span>
          </Pressable>
        </div>
      </div>;
    })}
  </div>;
}

export default function WorkspaceApp() {
  const layout = useWorkspaceSize();
  useKeyboardViewport();
  const [module, setModule] = useState<Module>("Today");
  const [calendarDay,setCalendarDay] = useState<string>();
  const [calendarSettingsPending,setCalendarSettingsPending] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [databases, setDatabases] = useState<DatabaseDefinition[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypes>({});
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectDraftType,setProjectDraftType] = useState<ProjectType>("app");
  const [createKind, setCreateKind] = useState<"page" | "database" | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>(() => { try { const value: unknown = JSON.parse(readSetting(`kimpor-recent-pages-${store.accountId}`, "[]")); return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string").slice(0, 8) : []; } catch { return []; } });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [peekId, setPeekId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSetting("velora-sidebar-collapsed", "false") === "true");
  const [trashOpen, setTrashOpen] = useState(false);
  const [purgeRequest, setPurgeRequest] = useState<{ pages: Page[]; owner: string } | null>(null);
  const [purging, setPurging] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const cloud = useSyncExternalStore(cloudState.subscribe, cloudState.getSnapshot);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const [toast, setToast] = useState<Toast | null>(null);
  const [error, setError] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [sort, setSort] = useState("updated");
  const [listView, setListView] = useState<"list" | "gallery">("list");
  const [filter, setFilter] = useState("");
  const [focus, setFocus] = useState(false);
  const [editing, setEditing] = useState(false);
  const history = useRef<{ module: Module; selected: string | null; scroll: number }[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(
    240,
  );
  const [listWidth, setListWidth] = useState(
    Number(readSetting("velora-list-width", "320")),
  );
  const mainRef = useRef<HTMLElement>(null);
  useCollapsingTitle(mainRef);
  useLayoutEffect(() => {
    if (selectedId) window.scrollTo({ top: 0, behavior: "instant" });
  }, [selectedId]);
  const refresh = useCallback(async () => {
    try {
      const [nextPages, nextEvents, nextDatabases, nextProjectTypes] = await Promise.all([
        store.listPages(true),
        store.listEvents(),
        store.listDatabases(),
        store.getSetting<ProjectTypes>("project-types-v1", {}),
      ]);
      setPages(nextPages);
      setEvents(nextEvents);
      setDatabases(nextDatabases);
      setProjectTypes({ ...inferProjectTypes(nextPages, nextDatabases), ...nextProjectTypes });
      setLoaded(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not open workspace.",
      );
    }
  }, []);
  useEffect(() => {
    void refresh();
    const unsubscribe = store.subscribe(() => void refresh());
    void platform.persistStorage();
    return unsubscribe;
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), toast.undo ? 10000 : 5000);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(
    () =>
      startReminders(
        () => store.listEvents(),
        (message) => setToast({ message }),
      ),
    [],
  );
  useEffect(() => {
    let stopped = false;
    let unlisten: (() => void) | undefined;
    void platform
      .onQuickCapture(() => {
        if (document.documentElement.dataset.appLocked !== "true")
          setCaptureOpen(true);
      })
      .then((cleanup) => {
        if (stopped) cleanup();
        else unlisten = cleanup;
      });
    return () => {
      stopped = true;
      unlisten?.();
    };
  }, []);
  useEffect(() => {
    let stopped = false;
    let unlisten: (() => void) | undefined;
    void platform
      .onQuit(() => {
        void flushEditors()
          .then(() => platform.quit())
          .catch((cause) => setError(String(cause)));
      })
      .then((cleanup) => {
        if (stopped) cleanup();
        else unlisten = cleanup;
      });
    return () => {
      stopped = true;
      unlisten?.();
    };
  }, []);
  useEffect(() => startAppearance(), []);
  useEffect(() => {
    const report = (event: Event) =>
      setError(String((event as CustomEvent).detail));
    window.addEventListener("velora-appearance-error", report);
    return () => window.removeEventListener("velora-appearance-error", report);
  }, []);
  useEffect(() => {
    const close = () => {
      setSearchOpen(false);
      setSettingsOpen(false);
      setCaptureOpen(false);
      setSidebarOpen(false);
      setTrashOpen(false);
      setPurgeRequest(null);
      setPeekId(null);
      setSelectedId(null);
    };
    window.addEventListener("velora-application-locked", close);
    return () => window.removeEventListener("velora-application-locked", close);
  }, []);
  const livePages = useMemo(
    () => store.listPages(),
    [pages],
  );
  const selected = livePages.find((page) => page.id === selectedId);
  const peek = livePages.find(page => page.id === peekId);
  useEffect(() => {
    if (loaded && selectedId && !store.listPages(true).some(page => page.id === selectedId)) { setSelectedId(null); setToast({message:"This page was deleted."}); }
    if (peekId && !store.listPages(true).some(page => page.id === peekId)) { setPeekId(null); setToast({message:"This page was deleted."}); }
    if (selectedId && store.listPages(true).find(page => page.id === selectedId)?.properties.__archived) setSelectedId(null);
    if (peekId && store.listPages(true).find(page => page.id === peekId)?.properties.__archived) setPeekId(null);
  }, [loaded, pages, selectedId, peekId]);
  const notify = (message: string, undo?: () => Promise<void>) =>
    setToast({ message, undo });
  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "That change could not be saved. Your existing data is safe.",
      );
    }
  };
  const navigate = useCallback((next: Module,day?:string) => {
    void flushEditors()
      .then(() => {
        history.current = [];
        setModule(next);
        setCalendarDay(next === "Calendar" ? day : undefined);
        setSelectedId(null);
        setSidebarOpen(false);
        setFolderId(null);
        setFocus(false);
        mainRef.current?.focus();
      })
      .catch((cause) => setError(String(cause)));
  }, []);
  const back = useCallback(() => {
    void flushEditors().then(() => {
      const previous = history.current.pop();
      setSelectedId(previous?.selected ?? null);
      if (previous) setModule(previous.module);
      requestAnimationFrame(() => { if (mainRef.current) mainRef.current.scrollTop = previous?.scroll ?? 0; mainRef.current?.focus(); });
    })
      .catch(cause => setError(String(cause)));
  }, []);
  const toggleSidebar = () => {
    if (layout.tablet) { setTabletExpanded(previous => !previous); return; }
    setSidebarCollapsed(previous => {
    const next = !previous;
    localStorage.setItem("velora-sidebar-collapsed", String(next));
    return next;
    });
  };
  const openPage = (id: string) => {
    void flushEditors()
      .then(() => {
        const page = store.listPages().find((item) => item.id === id);
        if (page) {
          if (selectedId !== id) history.current.push({ module, selected: selectedId, scroll: mainRef.current?.scrollTop ?? 0 });
          setModule(
            page.type === "note"
              ? "Notes"
              : page.type === "journal"
                ? "Journal"
                : "Projects",
          );
          setSelectedId(id);
          setRecentIds(previous => { const next = [id, ...previous.filter(item => item !== id)].slice(0, 8); writeSetting(`kimpor-recent-pages-${store.accountId}`, JSON.stringify(next)); return next; });
          setSidebarOpen(false);
          setEditing(false);
          requestAnimationFrame(() => { if (mainRef.current) mainRef.current.scrollTop = 0; mainRef.current?.focus(); });
        } else notify("This page is no longer available");
      })
      .catch((cause) => setError(String(cause)));
  };
  const create = async (
    type: PageType,
    title = "",
    extras: Partial<Page> = {},
  ) => {
    await flushEditors();
    history.current.push({ module, selected: selectedId, scroll: mainRef.current?.scrollTop ?? 0 });
    const page = await store.createPage(type, title, extras);
    setModule(
      type === "note" ? "Notes" : type === "journal" ? "Journal" : "Projects",
    );
    setSelectedId(page.id);
    setCaptureOpen(false);
    return page;
  };
  const movePage = async (
    id: string,
    parentId: string | null,
    after?: string | null,
  ) => {
    if (id === parentId) return;
    let ancestor = parentId;
    const visited = new Set<string>();
    while (ancestor) {
      if (ancestor === id || visited.has(ancestor)) {
        setError("A page cannot be moved into itself or one of its children.");
        return;
      }
      visited.add(ancestor);
      ancestor =
        livePages.find((page) => page.id === ancestor)?.parentId ?? null;
    }
    const movedPage = livePages.find(page => page.id === id);
    const previous = movedPage?.parentId ?? null;
    const previousOrder = livePages.find((page) => page.id === id)?.properties
      .__order;
    const siblings = livePages
      .filter((page) => page.parentId === parentId && page.id !== id)
      .sort(
        (a, b) =>
          compareOrder(a.properties.__order, b.properties.__order) ||
          a.createdAt.localeCompare(b.createdAt),
      );
    if (
      siblings.some(
        (page, index) =>
          typeof page.properties.__order !== "string" ||
          (index > 0 &&
            compareOrder(
              siblings[index - 1]!.properties.__order,
              page.properties.__order,
            ) >= 0),
      )
    ) {
      for (const [index, page] of siblings.entries()) {
        page.properties = { ...page.properties, __order: `${index}/1` };
        await store.patchPage(page.id, { properties: page.properties });
      }
    }
    const index =
      after === null
        ? 0
        : after === undefined
          ? siblings.length
          : siblings.findIndex((page) => page.id === after) + 1;
    const order = orderBetween(
      siblings[index - 1]?.properties.__order ?? null,
      siblings[index]?.properties.__order ?? null,
    );
    await store.movePage(id, parentId);
    await store.patchPage(id, {
      parentId,
      properties: {
        ...livePages.find((page) => page.id === id)?.properties,
        __order: order,
      },
    });
    notify("Page moved", () =>
      store
        .patchPage(id, {
          parentId: previous,
          type: movedPage?.type,
          databaseId: movedPage?.databaseId,
          properties: {
            ...store.listPages().find((page) => page.id === id)?.properties,
            __order: previousOrder ?? null,
          },
        })
        .then(() => {}),
    );
  };
  const trash = async (page: Page) => {
    await flushEditors();
    await store.trashPage(page.id);
    if (selectedId === page.id) setSelectedId(null);
    notify("Moved to Trash", () => store.restorePage(page.id).then(() => {}));
  };
  const purge = async () => {
    if (!purgeRequest || purging) return;
    const owner = purgeRequest.owner;
    setPurging(true);
    try {
      await flushEditors();
      if (store.accountId !== owner) throw new Error("Workspace account changed");
      if (owner !== "local") {
        if (!online || cloud.session?.user.id !== owner) throw new Error("Connect to the internet to delete forever.");
        await cloudState.sync();
        if (store.accountId !== owner || store.pendingCount()) throw new Error("Couldn't delete forever. Check your connection and try again.");
      }
      await store.purgePages(purgeRequest.pages.map(page => page.id), owner === "local" ? undefined : new SupabaseTransport());
      if (store.accountId !== owner) return;
      if (selectedId && !store.listPages().some(page => page.id === selectedId)) setSelectedId(null);
      setPurgeRequest(null); notify("Deleted forever");
    } finally { setPurging(false); }
  };
  const duplicate = async (page: Page) => {
    await flushEditors();
    const created = await store.duplicatePage(page.id);
    openPage(created.id);
  };
  const createWorkspaceItem = async (input: WorkspaceCreateInput) => {
    await flushEditors();
    let page: Page;
    if (input.kind === "database") {
      const status = input.properties.find(property => property.type === "status");
      page = await store.createDatabase(input.title, {
        properties: [{ id: "title", name: "Name", type: "title" }, ...(input.view === "calendar" && !input.properties.some(property => property.type === "date") ? [{ id: "date", name: "Date", type: "date" as const }] : []), ...input.properties.map(property => ({ ...property, name: property.name.trim(), options: property.options?.filter(Boolean) }))],
        views: [{ id: crypto.randomUUID(), name: input.view[0]!.toUpperCase() + input.view.slice(1), type: input.view }],
        defaultProperties: status ? { [status.id]: status.options?.[0] ?? "" } : {},
      }, { parentId: input.parentId, icon: "▦", properties: { __workspaceDatabase: true } });
    } else if (input.template in pageStarters) {
      page = await store.createPage("page", input.title, { parentId: input.parentId });
      const content = pageStarters[input.template];
      if (content) {
        const { markdownToDocument } = await import("@veloradesk/core/export");
        await store.saveDoc(page.id, markdownToDocument(content));
      }
    } else {
      page = await store.duplicatePage(input.template, input.title);
      await store.movePage(page.id, input.parentId);
      await store.patchPageProperties(page.id, { __template: false });
    }
    setCreateKind(null); setProjectOpen(false); openPage(page.id);
  };
  const createProject = async (type: ProjectType, title = projectPreset(type)!.label, icon = "▦") => {
    const page = await create("database", title, { icon, properties: { __projectType: type, __tasks: true } });
    const definition = projectDefinition(page, type);
    await store.saveDatabase(definition);
    const preset = projectPreset(type)!;
    for (const title of preset.checklist ?? []) await store.createPage("row", title, {
      databaseId: page.id, parentId: page.id,
      properties: { due: localDate(), completed: false, week: weekNumber(new Date()), status: "To do", cadence: "Weekly", __weekly: type === "weekly" || type === "model" },
    });
    setProjectOpen(false);
    return page;
  };
  const addTask = async (title: string, projectId: string, due: string, notes: string) => {
    let project = livePages.find(page => page.type === "database" && !page.properties.__workspaceDatabase && page.id === projectId)
      ?? livePages.find(page => page.type === "database" && !page.properties.__workspaceDatabase && page.properties.__tasks);
    project ??= await createProject("app", "Inbox");
    const definition = store.listDatabases().find(database => database.id === project!.id);
    const status = definition?.properties.find(property => property.type === "status");
    const date = definition?.properties.find(property => property.type === "date");
    const task = await store.createPage("row", title, { databaseId: project.databaseId ?? project.id, parentId: project.id,
      properties: { ...(status ? { [status.id]: status.options?.[0] ?? "To do" } : {}), ...(due ? { [date?.id ?? "due"]: due } : {}) } });
    if (notes.trim()) {
      const { markdownToDocument } = await import("@veloradesk/core/export");
      await store.saveDoc(task.id, markdownToDocument(notes));
    }
    setCaptureOpen(false); setSelectedId(null); setModule("Today");
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        event.keyCode === 229 ||
        document.documentElement.dataset.appLocked === "true"
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "n"
      ) {
        event.preventDefault();
        setCaptureOpen(true);
      }
      if (event.key === "Escape" && focus) setFocus(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);
  const typeFilter =
    module === "Notes" ? "note" : module === "Journal" ? "journal" : undefined;
  const listPages = livePages
    .filter(
      (page) =>
        page.type !== "row" &&
        (!typeFilter || page.type === typeFilter) &&
        (typeFilter
          ? !folderId || page.parentId === folderId
          : page.type !== "journal" && page.type !== "note") &&
        (titleOf(page)
          .toLocaleLowerCase()
          .includes(filter.toLocaleLowerCase()) ||
          page.tags
            .join(" ")
            .toLocaleLowerCase()
            .includes(filter.toLocaleLowerCase())),
    )
    .sort((a, b) =>
      sort === "title"
        ? titleOf(a).localeCompare(titleOf(b))
        : sort === "created"
          ? b.createdAt.localeCompare(a.createdAt)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  const resize = (kind: "sidebar" | "list", event: React.PointerEvent) => {
    const initial = kind === "sidebar" ? sidebarWidth : listWidth;
    const start = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
    const move = (next: PointerEvent) => {
      const width = Math.max(
        kind === "sidebar" ? 180 : 240,
        Math.min(
          kind === "sidebar" ? 360 : 520,
          initial + next.clientX - start,
        ),
      );
      if (kind === "sidebar") setSidebarWidth(width);
      else setListWidth(width);
      writeSetting(`velora-${kind}-width`, String(width));
    };
    const done = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", done);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done, { once: true });
  };
  return (
    <div
      data-module={module}
      data-writing={Boolean(selected && selected.type !== "database")}
      data-editing={editing}
      data-layout={layout.phone ? "phone" : layout.tablet ? "tablet" : "desktop"}
      onFocusCapture={event => setEditing(event.target instanceof Element && !!event.target.closest(".rich-editor,.ws-page-title"))}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEditing(false); }}
      className={`ws-app ${focus ? "focus-mode" : ""} ${selected ? "has-detail" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${tabletExpanded ? "tablet-expanded" : ""}`}
      style={
        {
          "--ws-sidebar-width": `${sidebarWidth}px`,
          "--ws-list-width": `${listWidth}px`,
        } as React.CSSProperties
      }
    >
      {!focus && (
        <>
          <aside
            className={`ws-sidebar ${sidebarOpen ? "open" : ""}`}
            aria-label="Sidebar"
            aria-hidden={layout.phone && !sidebarOpen}
            inert={layout.phone && !sidebarOpen}
          >
            <div className="ws-brand">
              <span className="logo">
                <BrandMark size={28} />
              </span>
              <strong>Kimpor Workspace</strong>
              <Pressable
                className="ws-icon ws-sidebar-close"
                aria-label="Close sidebar"
                onClick={() => setSidebarOpen(false)}
              >
                <X size={20} />
              </Pressable>
            </div>
            <Pressable
              className="ws-sidebar-search"
              aria-label="Search anything"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} />
              <span>Search anything</span>
              <kbd>⌘ K</kbd>
            </Pressable>
            <Pressable className="ws-icon ws-sidebar-collapse" aria-label={layout.tablet ? tabletExpanded ? "Compact sidebar" : "Expand sidebar" : sidebarCollapsed ? "Expand sidebar" : "Compact sidebar"} onClick={toggleSidebar}>{sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</Pressable>
            <nav aria-label="Main navigation">
              {modules.map(({ name, icon: Icon }) => (
                <Pressable
                  key={name}
                  className={`ws-nav ${module === name ? "selected" : ""}`}
                  aria-current={module === name ? "page" : undefined}
                  aria-label={name}
                  onClick={() => navigate(name)}
                >
                  <Icon size={20} />
                  <span>{name}</span>
                </Pressable>
              ))}
            </nav>
            {livePages.some(page=>page.favorite)&&<section className="ws-sidebar-section ws-favorites" aria-label="Favorites"><div className="ws-sidebar-section-title"><span>Favorites</span></div>{livePages.filter(page=>page.favorite).map(page=><Pressable className={`ws-sidebar-page ${selectedId===page.id?"selected":""}`} key={page.id} onClick={()=>openPage(page.id)}><span>{pageIcon(page)}</span><span>{titleOf(page)}</span></Pressable>)}</section>}
            <details className="ws-sidebar-section ws-sidebar-projects" open><summary className="ws-sidebar-section-title"><span>Projects</span></summary><Pressable className="ws-icon ws-section-add" aria-label="Add project" onClick={()=>setProjectOpen(true)}><Plus size={16}/></Pressable>{livePages.filter(page=>page.type==="database"&&!page.properties.__workspaceDatabase).map(page=><Pressable className={`ws-sidebar-page ${selectedId===page.id?"selected":""}`} key={page.id} onClick={()=>openPage(page.id)}><span>{pageIcon(page)}</span><span>{titleOf(page)}</span><small>{livePages.filter(row=>row.databaseId===page.id&&row.type==="row").length}</small></Pressable>)}</details>
            <div className="ws-sidebar-section">
              <div className="ws-sidebar-section-title">
                <span>Pages</span>
                <Pressable
                  className="ws-icon"
                  aria-label="New page"
                  onClick={() => setCreateKind("page")}
                >
                  <Plus size={16} />
                </Pressable>
              </div>
              <Tree
                pages={livePages.filter(page=>page.type!=="database"||page.properties.__workspaceDatabase)}
                selected={selectedId}
                onOpen={openPage}
                onMove={(id, parent, after) =>
                  void run(() => movePage(id, parent, after))
                }
              />
            </div>
            <div className="ws-sidebar-footer">
              <Pressable className="ws-sidebar-link" aria-label="Archive" onClick={() => setArchiveOpen(true)}><Folder size={17} /><span>Archive</span></Pressable>
              <Pressable
                className="ws-sidebar-link"
                aria-label="Trash"
                onClick={() => setTrashOpen(true)}
              >
                <Trash2 size={17} />
                <span>Trash</span>
                <span className="ws-count">
                  {trashRoots(pages).length || ""}
                </span>
              </Pressable>
              <Pressable
                className="ws-sidebar-link"
                aria-label="Settings"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={17} />
                <span>Settings</span>
              </Pressable>
            </div>
          </aside>
          <div
            className="ws-resize ws-sidebar-resize"
            role="separator"
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            onPointerDown={(event) => resize("sidebar", event)}
          />
        </>
      )}
      <main className="ws-main" ref={mainRef} tabIndex={-1} inert={layout.phone && sidebarOpen}>
        {selected && <EdgeBack main={mainRef} onBack={back} />}
        <header className="ws-topbar">
          <div className="ws-topbar-leading">
            {!focus && (
              <Pressable
                className="ws-icon ws-menu-button"
                aria-label="Open sidebar"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={20} />
              </Pressable>
            )}
            {selected ? (
              <>
                <Pressable
                  className="ws-icon ws-detail-back"
                  aria-label={`Back to ${history.current.at(-1)?.module ?? module}`}
                  onClick={back}
                >
                  <ChevronLeft size={20} />
                </Pressable>
                <span className="ws-breadcrumb">
                  <Pressable className="ws-breadcrumb-link" onClick={() => navigate(module)}>{module}</Pressable>
                  {(() => { const parents: Page[] = []; const seen = new Set([selected.id]); let parent = livePages.find(page => page.id === selected.parentId); while (parent && !seen.has(parent.id)) { parents.unshift(parent); seen.add(parent.id); parent = livePages.find(page => page.id === parent!.parentId); } return parents.map(parent => <span key={parent.id}><ChevronRight size={14} /><Pressable className="ws-breadcrumb-link" onClick={() => openPage(parent.id)}>{titleOf(parent)}</Pressable></span>); })()}
                  <ChevronRight size={14} /><strong>{titleOf(selected)}</strong>
                </span>
              </>
            ) : (
              <div className="ws-breadcrumb">{module === "Calendar" && layout.phone ? <h1 className="ws-calendar-title">Calendar</h1> : <span className="ws-module-breadcrumb">{module}</span>}</div>
            )}
          </div>
          <div className="ws-topbar-actions">{selected ? <>
            <SyncRetry /><Pressable className="ws-icon" aria-label="Page options" onClick={() => window.dispatchEvent(new CustomEvent("kimpor-page-options", { detail: selected.id }))}><MoreHorizontal size={20} /></Pressable>
          </> : <>
            {module === "Calendar" && layout.phone && <Pressable className="ws-icon" aria-label="Calendar settings and accounts" onClick={() => window.dispatchEvent(new Event('kimpor-calendar-settings'))}><Settings size={20}/></Pressable>}
            <SyncRetry /><Pressable className="ws-icon" aria-label="Search workspace" onClick={() => setSearchOpen(true)}><Search size={20} /></Pressable>

          </>}</div>
        </header>
        <AppUpdateNotice />
        {error && (
          <div role="alert" className="ws-error">
            <span>{error}</span>
            <Pressable
              className="ws-icon"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={18} />
            </Pressable>
          </div>
        )}
        {!loaded ? (
          <Loading />
        ) : module === "Calendar" && !selected ? (
          <Suspense fallback={<Loading />}>
            <CalendarModule onOpenPage={openPage} initialDay={calendarDay} requestSettings={calendarSettingsPending} onSettingsOpened={()=>setCalendarSettingsPending(false)}/>
          </Suspense>
        ) : module === "Today" && !selected ? (
          <Today
            pages={livePages}
            types={projectTypes}
            events={events}
            onOpen={openPage}
            onCapture={() => setCaptureOpen(true)}
            databases={databases}
            onCalendar={day => navigate("Calendar",day)}
            onComplete={(page) =>
              void run(async () => {
                const previous = { ...page.properties };
                await completeProjectTask(store, page, databases.find(database => database.id === page.databaseId));
                notify("Task completed", () =>
                  store
                    .patchPage(page.id, { properties: previous })
                    .then(() => {}),
                );
              })
            }
          />
        ) : module === "Journal" && !selected ? (
          <JournalHome pages={livePages.filter(page => page.type === "journal")}
            onOpen={openPage} onWrite={(date) => {
              const existing = livePages.find(page => page.type === "journal" && page.date === date);
              if (existing) openPage(existing.id);
              else void run(() => create("journal", "", { date }));
            }} />
        ) : (
          <div className={`ws-module-body ${selected ? "with-detail" : ""} ${selected?.type === "database" ? "project-detail" : ""}`}>
            <section className="ws-list-pane" aria-label={`${module} list`}>
{["Projects"].includes(module) ? <Suspense fallback={<Loading/>}><ProjectsHome projects={listPages.filter(page=>page.type === "database" && !page.properties.__workspaceDatabase)} pages={livePages} databases={databases} types={projectTypes} query={filter} onQuery={setFilter} sort={sort} onSort={setSort} onOpen={openPage} onNew={type=>{setProjectDraftType(type??"app");setProjectOpen(true);}} onRename={page=>void run(async()=>{const title=await requestText({title:"Rename project",label:"Project name",initialValue:page.title});if(title?.trim())await store.patchPage(page.id,{title:title.trim()});})} onDuplicate={page=>void run(()=>duplicate(page))} onTrash={page=>void run(()=>trash(page))} onPage={()=>setCreateKind("page")} onDatabase={()=>setCreateKind("database")}/></Suspense> : <>
              <div className="ws-list-heading">
                <div>
                  <h1>{module}</h1>
                </div>
                {module !== "Journal" && listPages.length > 0 && (
                <Pressable
                  className="ws-icon ws-tinted"
                  aria-label={`New ${module === "Notes" ? "note" : "project"}`}
                  onClick={() => module === "Projects" ? setProjectOpen(true) :
                    void run(() =>
                      create(
                        module === "Notes" ? "note" : "page",
                        "",
                        {
                          date: null,
                          parentId: folderId,
                        },
                      ),
                    )
                  }
                >
                  <Plus size={20} />
                </Pressable>
                )}
              </div>
              <div className="ws-list-tools">
                <label className="ws-search-field">
                  <Search size={16} />
                  <input
                    type="search"
                    aria-label={`Search ${module}`}
                    placeholder={`Search ${module.toLowerCase()}`}
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  />
                </label>
                {module === "Projects" ? <ActionMenu label="Sort Projects" items={[["updated","Last edited"],["created","Created"],["title","Title"]].map(([value,label])=>({label:label!,onSelect:()=>setSort(value!)}))}>{sort === "updated" ? "Last edited" : sort === "created" ? "Created" : "Title"}<ChevronDown size={14}/></ActionMenu> : (
                <select
                  aria-label={`Sort ${module}`}
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="updated">Last edited</option>
                  <option value="created">Created</option>
                  <option value="title">Title</option>
                </select>
                )}
                <Pressable
                  className="ws-icon"
                  aria-label={
                    listView === "list" ? "Show gallery view" : "Show list view"
                  }
                  onClick={() =>
                    setListView((value) =>
                      value === "list" ? "gallery" : "list",
                    )
                  }
                >
                  {listView === "list" ? (
                    <LayoutGrid size={18} />
                  ) : (
                    <List size={18} />
                  )}
                </Pressable>
              </div>
              {module === "Notes" && (
                <div className="ws-folder-tools">
                  <select
                    aria-label="Notes folder"
                    value={folderId ?? ""}
                    onChange={(event) =>
                      setFolderId(event.target.value || null)
                    }
                  >
                    <option value="">All notes</option>
                    {livePages
                      .filter((page) => page.properties.__folder)
                      .map((page) => (
                        <option key={page.id} value={page.id}>
                          {titleOf(page)}
                        </option>
                      ))}
                  </select>
                  <Pressable
                    className="ws-icon"
                    aria-label="New notes folder"
                    onClick={() =>
                      void run(async () => {
                        const name = await requestText({title:"New folder",label:"Folder name",confirmLabel:"Create folder"});
                        if (name?.trim())
                          await create("page", name.trim(), {
                            properties: { __folder: true },
                            icon: "🗂️",
                            parentId: folderId,
                          });
                      })
                    }
                  >
                    <Folder size={18} />
                    <Plus size={12} />
                  </Pressable>
                </div>
              )}
              {listPages.length ? (
                module === "Projects" ? <>
                  <div className="ws-project-pages">
                    {!filter && <>{livePages.some(page => page.favorite) && <><h2>Favorites</h2>{livePages.filter(page => page.favorite).map(page => <PageButton key={page.id} page={page} onOpen={openPage} small />)}</>}
                    {recentIds.some(id => livePages.some(page => page.id === id)) && <><h2>Recent</h2>{recentIds.flatMap(id => { const page = livePages.find(page => page.id === id); return page ? [<PageButton key={page.id} page={page} onOpen={openPage} small />] : []; })}</>}</>}
                    <h2>Pages and databases</h2>
                    {filter || listView === "gallery" ? <PageList pages={listPages} onOpen={openPage} gallery={listView === "gallery"} /> : <Tree pages={livePages.filter(page => page.type !== "note")} sort={sort} selected={selectedId} onOpen={openPage} onMove={(id, parent, after) => void run(() => movePage(id, parent, after))} />}
                  </div>
                  <div className="ws-project-overview">{listPages.filter(page => page.type === "database" && !page.properties.__workspaceDatabase).map(project => <ProjectCard key={project.id} project={project} pages={livePages} definition={databases.find(definition => definition.id === project.id)} types={projectTypes} onOpen={openPage} />)}</div></> : <PageList pages={listPages} onOpen={openPage} gallery={listView === "gallery"} />
              ) : (
                <div className={`ws-page-list ${listView === "gallery" ? "gallery" : ""}`}>
                  <Empty
                    title={
                      filter
                        ? "No matching items"
                        : `Your ${module.toLowerCase()} starts here`
                    }
                    action={<Pressable className="ws-button ws-tinted" onClick={() => filter ? setFilter("") : module === "Projects" ? setProjectOpen(true) : void run(() => create("note"))}>{filter ? "Clear" : module === "Projects" ? "New project" : "New note"}</Pressable>}
                  >
                    {filter
                      ? "Try a different word or tag."
                      : module === "Journal"
                        ? "Write a few words, keep a memory, or simply check in."
                        : module === "Notes"
                          ? "Ideas, checklists, and everything you want to keep."
                          : ""}
                  </Empty>
                </div>
              )}
              </>}
            </section>
            {selected && (
              <>
                <div
                  className="ws-resize ws-list-resize"
                  role="separator"
                  aria-label="Resize list pane"
                  aria-orientation="vertical"
                  onPointerDown={(event) => resize("list", event)}
                />
                <section
                  className={`ws-detail-pane ${selected.fullWidth ? "full-width" : ""}`}
                  aria-label="Page detail"
                >
                  <PageDetail
                    key={selected.id}
                    page={selected}
                    pages={livePages}
                    databases={databases}
                    projectTypes={projectTypes}
                    onOpen={openPage}
                    onPeek={id => {
                      if ((mainRef.current?.clientWidth ?? 0) < 1280) { openPage(id); return; }
                      void run(async () => { await flushEditors(); setPeekId(id); });
                    }}
                    onPatch={(patch) =>
                      run(() => store.patchPage(selected.id, patch))
                    }
                    onTrash={() => void run(() => trash(selected))}
                    onDuplicate={() => void run(() => duplicate(selected))}
                    onMove={(parent) =>
                      void run(() => movePage(selected.id, parent))
                    }
                    onFocus={() => setFocus(true)}
                    onNotify={notify}
                    onError={setError}
                  />
                </section>
              </>
            )}
          </div>
        )}
      </main>
      {!focus && (
        <>
          <nav className="ws-tabbar" aria-label="Bottom navigation">
            {modules.map(({ name, icon: Icon }) => (
              <Pressable
                key={name}
                className={`ws-tab ${module === name ? "selected" : ""}`}
                aria-label={name}
                aria-current={module === name ? "page" : undefined}
                onClick={() => navigate(name)}
              >
                <Icon size={22} />
                <span>{name}</span>
              </Pressable>
            ))}
          </nav>
        </>
      )}
      {sidebarOpen && (
        <Pressable
          className="ws-sidebar-scrim"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sheet
        open={captureOpen}
        onOpenChange={setCaptureOpen}
        title="New task"
      >
        <Capture projects={livePages.filter(page => page.type === "database" && !page.properties.__workspaceDatabase)}
          onCreate={(title, projectId, due, notes) => run(() => addTask(title, projectId, due, notes))} />
      </Sheet>
      <Sheet open={projectOpen} onOpenChange={setProjectOpen} title="New project"><Suspense fallback={<Loading/>}><NewProject key={projectDraftType} initialType={projectDraftType} onCreate={(type,title,icon)=>run(()=>createProject(type,title,icon))}/></Suspense></Sheet>
      <Sheet open={!!createKind} onOpenChange={open => { if (!open) setCreateKind(null); }} title={createKind === "database" ? "New database" : "New page"}>
        {createKind && <WorkspaceCreate key={createKind} kind={createKind} pages={livePages} onCreate={createWorkspaceItem} />}
      </Sheet>
      <Sheet open={archiveOpen} onOpenChange={setArchiveOpen} title="Archive">
        <p className="ws-help">Archived pages stay saved and are hidden from navigation. Restore them here.</p>
        {store.listPages(false, true).filter(page => page.properties.__archived && !store.listPages(false, true).some(parent => parent.id === page.parentId && parent.properties.__archived)).map(page => <div className="ws-trash-row" key={page.id}><strong>{titleOf(page)}</strong><Pressable className="ws-button" onClick={() => void run(async () => { await store.unarchivePage(page.id); notify("Page restored from Archive"); })}>Restore</Pressable></div>)}
        {!store.listPages(false, true).some(page => page.properties.__archived) && <p>No archived pages.</p>}
      </Sheet>
      <Sheet
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Search"
        wide
      >
        <SearchPanel
          pages={livePages}
          events={events}
          onOpen={(id) => {
            openPage(id);
            setSearchOpen(false);
          }}
          onCalendar={() => {
            navigate("Calendar");
            setSearchOpen(false);
          }}
          onAction={(name) => {
            navigate(name);
            setSearchOpen(false);
          }}
        />
      </Sheet>
      {settingsOpen && <Suspense fallback={<Loading/>}><SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onNotify={notify} onError={setError} onTrash={()=>{setSettingsOpen(false);setTrashOpen(true);}} onCalendars={()=>{setSettingsOpen(false);setCalendarSettingsPending(true);navigate("Calendar");}} trashCount={trashRoots(pages).length}/></Suspense>}
      <WorkspacePrompt/>
      <Dialog.Root open={!!peek} onOpenChange={open => { if (!open) void run(async () => { await flushEditors(); setPeekId(null); }); }}><Dialog.Portal container={document.getElementById("root")}><Dialog.Overlay className="ws-overlay" /><Dialog.Content className="ws-row-peek project-side-peek"><div className="ws-sheet-heading"><Dialog.Title>Item</Dialog.Title><Pressable className="ws-button" onClick={()=>void run(async()=>{await flushEditors();const id=peekId;setPeekId(null);if(id)openPage(id);})}>Open as full page</Pressable><Dialog.Close asChild><Pressable className="ws-icon" aria-label="Close item"><X size={20} /></Pressable></Dialog.Close></div><Dialog.Description className="ws-sr-only">Item properties and notes</Dialog.Description>{peek && <PageDetail key={peek.id} page={peek} pages={livePages} databases={databases} projectTypes={projectTypes} onOpen={openPage} onPatch={patch => run(() => store.patchPage(peek.id,patch))} onTrash={() => void run(() => trash(peek))} onDuplicate={() => void run(() => duplicate(peek))} onMove={parent => void run(() => movePage(peek.id,parent))} onFocus={() => setFocus(true)} onNotify={notify} onError={setError}/>}</Dialog.Content></Dialog.Portal></Dialog.Root>
      <Sheet open={trashOpen} onOpenChange={setTrashOpen} title="Trash">
        <TrashPanel pages={pages} canDelete={store.accountId === "local" || (online && cloud.session?.user.id === store.accountId)}
          onRestore={ids => void run(async () => { for (const id of ids) await store.restorePage(id); notify("Item restored"); })}
          onDelete={items => setPurgeRequest({ pages: items, owner: store.accountId })} />
      </Sheet>
      <Sheet open={!!purgeRequest} onOpenChange={open => { if (!open && !purging) setPurgeRequest(null); }} alert
        title={purgeRequest?.pages.length === 1 ? `Delete ${titleOf(purgeRequest.pages[0]!)} forever?` : `Delete ${purgeRequest?.pages.length ?? 0} items forever?`}>
        <p>This removes the page, its history and its attachments from your account and every signed-in device. This can't be undone.</p>
        <div className="ws-confirm-actions"><Pressable className="ws-button ws-tinted" data-sheet-autofocus disabled={purging} onClick={() => setPurgeRequest(null)}>Cancel</Pressable>
          <Pressable className="ws-button ws-danger" disabled={purging} onClick={() => void run(purge)}>{purging ? "Deleting…" : "Delete forever"}</Pressable></div>
      </Sheet>
      {toast && (
        <div className="ws-toast" role="status">
          <Check size={18} />
          <span>{toast.message}</span>
          {toast.undo && (
            <Pressable
              className="ws-button"
              onClick={() =>
                void run(async () => {
                  await toast.undo?.();
                  setToast(null);
                })
              }
            >
              Undo
            </Pressable>
          )}
          <Pressable
            className="ws-icon"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </Pressable>
        </div>
      )}
    </div>
  );
}

function JournalHome({ pages, onOpen, onWrite }: { pages: Page[]; onOpen: (id: string) => void; onWrite: (date: string) => void; }) {
  const [query, setQuery] = useState("");
  const entries = pages.filter(page => `${page.title} ${page.properties.__locked ? "" : page.properties.__text ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a,b) => (b.date ?? b.createdAt.slice(0,10)).localeCompare(a.date ?? a.createdAt.slice(0,10)));
  const today = pages.find(page => page.date === localDate());
  const write = () => today ? onOpen(today.id) : onWrite(localDate());
  return <section className="ws-journal-home" aria-label="Journal">
    <header className="ws-journal-home-heading"><h1>Journal</h1>{pages.length > 0 && <Pressable className="ws-button ws-tinted" aria-label={today ? "Continue" : "Write"} onClick={write}><PenLine size={18} />{today ? "Continue" : "Write"}</Pressable>}</header>
    {pages.length > 0 && <label className="ws-search-field"><Search size={18} /><input type="search" aria-label="Search journal" placeholder="Search" value={query} onChange={event => setQuery(event.target.value)} /></label>}
    {entries.length ? <PageList pages={entries} onOpen={onOpen} gallery={false} /> : <div className="ws-journal-empty"><BookOpen size={32} /><Pressable className="ws-button ws-tinted" aria-label={query ? "Clear" : "Write"} onClick={() => query ? setQuery("") : write()}>{query ? "Clear" : "Write"}</Pressable></div>}
    {pages.length > 0 && <JournalOverview pages={pages} onOpen={onOpen} onWrite={() => onWrite(localDate())} />}
  </section>;
}

function JournalOverview({ pages, onOpen }: {
  pages: Page[];
  onOpen: (id: string) => void;
  onWrite: () => void;
}) {
  const days = Array.from({ length: 84 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 83 + index);
    return localDate(date);
  });
  let streak = 0;
  const dates = new Set(pages.map((page) => page.date));
  for (let offset = 0; offset < 366; offset++) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    if (!dates.has(localDate(date))) break;
    streak++;
  }
  return (
    <div className="ws-journal-overview">
      <details className="ws-journal-history">
        <summary>History<ChevronDown size={16} aria-hidden="true" /></summary>
        <p className="ws-journal-history-caption">Last 12 weeks{streak ? ` · ${streak} ${streak === 1 ? "day" : "days"} of writing` : ""}</p>
      <div className="ws-journal-week" aria-label="Journal this week">
        {days.slice(-7).map((date) => {
          const entry = pages.find((page) => page.date === date);
          return <Pressable key={date} className={entry ? "written" : ""}
            aria-label={`${displayDate(date)}: ${entry ? "entry written" : "no entry"}`}
            onClick={() => entry && onOpen(entry.id)} disabled={!entry}>
            <span>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })}</span>
            <span>{Number(date.slice(-2))}</span>
            <i aria-hidden="true" />
          </Pressable>;
        })}
      </div>
        <div className="ws-heatmap" aria-label="Journal entries in the last twelve weeks">
          {days.map((date) => {
            const entry = pages.find((page) => page.date === date);
            return <span key={date} className={`ws-heatmap-day ${entry ? "written" : ""}`}
              title={`${displayDate(date)}: ${entry ? "entry written" : "no entry"}`} />;
          })}
        </div>
      </details>
    </div>
  );
}

function Capture({ projects, onCreate }: { projects: Page[];
  onCreate: (title: string, projectId: string, due: string, notes: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  return <form className="ws-task-capture" onSubmit={event => {
    event.preventDefault(); if (busy || !title.trim()) return; setBusy(true);
    void onCreate(title.trim(), projectId, due, notes).finally(() => setBusy(false));
  }}>
    <input className="ws-input ws-task-name-input" aria-label="Task name" placeholder="Task name" autoFocus required value={title} onChange={event => setTitle(event.target.value)} />
    <details><summary>Details</summary>
      <label className="ws-field-label">Project<select className="ws-input" value={projectId} onChange={event => setProjectId(event.target.value)}><option value="">Inbox</option>{projects.map(project => <option value={project.id} key={project.id}>{titleOf(project)}</option>)}</select></label>
      <label className="ws-field-label">Date<input className="ws-input" type="date" value={due} onChange={event => setDue(event.target.value)} /></label>
      <label className="ws-field-label">Notes<textarea className="ws-input" value={notes} onChange={event => setNotes(event.target.value)} /></label>
    </details>
    <Pressable type="submit" className="ws-button ws-filled" disabled={busy || !title.trim()}>Add task</Pressable>
  </form>;
}

function SearchPanel({
  pages,
  events,
  onOpen,
  onCalendar,
  onAction,
}: {
  pages: Page[];
  events: CalendarEvent[];
  onOpen: (id: string) => void;
  onCalendar: () => void;
  onAction: (name: Module) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [date, setDate] = useState("");
  const searcher = useRef<LocalSearch | null>(null);
  const [resultIds, setResultIds] = useState<string[]>([]);
  useEffect(() => {
    searcher.current = new LocalSearch();
    return () => {
      searcher.current?.dispose();
      searcher.current = null;
    };
  }, []);
  useEffect(() => {
    searcher.current?.index([
      ...pages
        .filter((page) => !page.properties.__locked)
        .map((page) => ({
          id: "page:" + page.id,
          type: page.type,
          title: page.title,
          text:
            page.tags.join(" ") + " " + String(page.properties.__text ?? ""),
          date: page.date ?? page.createdAt.slice(0, 10),
        })),
      ...events
        .filter((event) => !event.deletedAt)
        .map((event) => ({
          id: "event:" + event.id,
          type: "event",
          title: event.title,
          text: event.location + " " + event.notes,
          date: event.start.slice(0, 10),
        })),
    ]);
  }, [pages, events]);
  useEffect(() => {
    let active = true;
    void searcher.current
      ?.search(query, {
        type: type === "all" ? undefined : type,
        after: date || undefined,
        before: date || undefined,
      })
      .then((ids) => {
        if (active) setResultIds(ids);
      });
    return () => {
      active = false;
    };
  }, [pages, events, query, type, date]);
  const results = resultIds
    .filter((id) => id.startsWith("page:"))
    .map((id) => pages.find((page) => page.id === id.slice(5)))
    .filter((page): page is Page => !!page)
    .slice(0, 30);
  const eventResults = resultIds
    .filter((id) => id.startsWith("event:"))
    .map((id) => events.find((event) => event.id === id.slice(6)))
    .filter((event): event is CalendarEvent => !!event)
    .slice(0, 15);
  return (
    <div>
      <label className="ws-search-field large">
        <Search size={20} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          data-sheet-autofocus
          aria-label="Search query"
        />
      </label>
      <div className="ws-search-filters">
        <select
          value={type}
          aria-label="Search item type"
          onChange={(event) => setType(event.target.value)}
        >
          <option value="all">All types</option>
          <option value="page">Pages</option>
          <option value="note">Notes</option>
          <option value="journal">Journal</option>
          <option value="event">Events</option>
          <option value="row">Tasks</option>
        </select>
        <input
          type="date"
          value={date}
          aria-label="Search date"
          onChange={(event) => setDate(event.target.value)}
        />
      </div>
      {!query && !date ? (
        <>
          <p className="ws-eyebrow">GO TO</p>
          {modules.map(({ name, icon: Icon }) => (
            <Pressable
              className="ws-page-row"
              key={name}
              onClick={() => onAction(name)}
            >
              <Icon size={20} />
              <strong>{name}</strong>
              <ChevronRight size={16} />
            </Pressable>
          ))}
        </>
      ) : (
        <div aria-live="polite">
          <p className="ws-muted">
            {results.length + eventResults.length}{" "}
            {results.length + eventResults.length === 1 ? "result" : "results"}
          </p>
          {results.map((page) => (
            <PageButton key={page.id} page={page} onOpen={onOpen} />
          ))}
          {eventResults.map((event) => (
            <Pressable
              className="ws-page-row"
              key={event.id}
              onClick={onCalendar}
            >
              <CalendarDays size={20} />
              <span className="ws-page-row-text">
                <strong>{event.title}</strong>
                <span>{displayDate(event.start)}</span>
              </span>
              <ChevronRight size={16} />
            </Pressable>
          ))}
          {!results.length && !eventResults.length && (
            <Empty title="Nothing found yet">
              Try another word, type, or date.
            </Empty>
          )}
        </div>
      )}
    </div>
  );
}

function PageDetail({
  page,
  onPeek,
  pages,
  databases,
  projectTypes,
  onOpen,
  onPatch,
  onTrash,
  onDuplicate,
  onMove,
  onFocus,
  onNotify,
  onError,
}: {
  page: Page;
  onPeek?: (id:string) => void;
  pages: Page[];
  databases: DatabaseDefinition[];
  projectTypes: ProjectTypes;
  onOpen: (id: string) => void;
  onPatch: (patch: Partial<Page>) => Promise<void>;
  onTrash: () => void;
  onDuplicate: () => void;
  onMove: (parent: string | null) => void;
  onFocus: () => void;
  onNotify: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const openFormatting = useRef(false);
  useEffect(() => {
    const open = (event: Event) => { if ((event as CustomEvent).detail === page.id) setMenuOpen(true); };
    window.addEventListener("kimpor-page-options", open);
    return () => window.removeEventListener("kimpor-page-options", open);
  }, [page.id]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [titleState, setTitleState] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTitle = useRef<string | null>(null);
  const titleFlight = useRef<Promise<void>>(Promise.resolve());
  const lastText = useRef("");
  useEffect(() => {
    if (pendingTitle.current === null) {
      setTitle(page.title);
      setTitleState("");
    }
    lastText.current = "";
  }, [page.id, page.title]);
  const persistTitle = useCallback(() => {
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = null;
    const next = pendingTitle.current;
    if (next === null) return titleFlight.current;
    pendingTitle.current = null;
    titleFlight.current = titleFlight.current
      .catch(() => {})
      .then(() => store.patchPage(page.id, { title: next }))
      .then(() => {
        if (pendingTitle.current === null) setTitleState("");
      })
      .catch((cause) => {
        if (pendingTitle.current === null) pendingTitle.current = next;
        setTitleState("Needs attention");
        throw cause;
      });
    return titleFlight.current;
  }, [page.id]);
  useEffect(() => registerEditorFlush(persistTitle), [persistTitle]);
  useEffect(
    () => () => {
      if (titleTimer.current) clearTimeout(titleTimer.current);
    },
    [],
  );
  const saveTitle = (next: string) => {
    setTitle(next);
    pendingTitle.current = next;
    setTitleState("");
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      void persistTitle().catch((cause) => onError(String(cause)));
    }, 300);
  };
  const definition = databases.find((database) => database.id === page.id);
  const backlinks = pages.filter(
    (candidate) =>
      !candidate.properties.__encrypted &&
      typeof candidate.properties.__text === "string" &&
      candidate.properties.__text.includes(`[[${page.title}]]`) &&
      candidate.id !== page.id,
  );
  return (
    <div
      className="ws-page-detail" data-page-type={page.type}
      key={page.id}
      onClickCapture={(event) => {
        const link = event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[data-page-mention]")
          : null;
        if (!link) return;
        event.preventDefault();
        event.stopPropagation();
        const id = link.dataset.pageMention;
        if (id && pages.some((candidate) => candidate.id === id)) onOpen(id);
        else onNotify("This page is in Trash or unavailable.");
      }}
    >
      {page.cover && (
        <div
          className={`ws-page-cover ${["blue", "purple", "warm"].includes(page.cover) ? page.cover : ""}`}
        />
      )}
      {titleState && <Pressable className="ws-sync-retry" aria-label="Retry title" onClick={() => void persistTitle().catch(cause => onError(String(cause)))}><span className="ws-status-dot" />Retry</Pressable>}
      <div className="ws-page-title-row">
        <Pressable
          className="ws-page-emoji"
          aria-label="Change page icon"
          onClick={() => setMenuOpen(true)}
        >
          {pageIcon(page)}
        </Pressable>
        <input
          ref={titleInput}
          className="ws-page-title"
          value={page.properties.__locked ? "Locked entry" : title}
          aria-label="Page title"
          placeholder="Untitled"
          readOnly={Boolean(page.properties.__locked)}
          onChange={(event) => saveTitle(event.target.value)}
          onBlur={() => {
            void persistTitle().catch((cause) => onError(String(cause)));
          }}
        />
      </div>
      {page.type === "database" && <input className="ws-project-description" aria-label={page.properties.__workspaceDatabase ? "Database description" : "Project description"} placeholder={page.properties.__workspaceDatabase ? "Describe this database" : "Stay organized with tasks, your way."} defaultValue={String(page.properties.__description ?? "")} onBlur={event => {
        const current = store.listPages().find(item => item.id === page.id);
        if (current) void store.patchPageProperties(page.id, { __description: event.target.value }).catch(cause => onError(String(cause)));
      }} />}
      {page.type === "row" && (
        <Suspense fallback={<Loading/>}><RowProperties
          page={page}
          definition={databases.find(
            (database) => database.id === page.databaseId,
          )}
          pages={pages}
          onError={onError}
        /></Suspense>
      )}
      {page.type === "database" ? (
        definition ? (
          <Suspense fallback={<Loading/>}><DatabaseEditor
            definition={definition}
            project={page}
            onPeek={onPeek}
            pages={pages}
            databases={databases}
            projectType={projectType(page, projectTypes)}
            onOpen={onOpen}
            onError={onError}
          /></Suspense>
        ) : (
          <Loading />
        )
      ) : (
        <Suspense fallback={<Loading />}>
          <RichTextEditor
            pageId={page.id}
            onTextChange={(text) => {
              if (text === lastText.current) return;
              lastText.current = text;
              if (!page.properties.__locked && text !== page.properties.__text)
                return store.patchPageProperties(page.id, { __text: text }).catch(cause => onError(String(cause)));
            }}
          />
        </Suspense>
      )}
      {page.type !== "database" && <details className="ws-page-details"><summary>Details</summary>
      {page.type === "journal" && <div className="ws-journal-entry-date"><CalendarDays size={15} /><time>{displayDate(page.date ?? localDate())}</time>
        <Pressable className="ws-journal-mood-summary" aria-label="Journal date and mood" onClick={() => setMenuOpen(true)}>
          {page.properties.mood ? ["😔", "🙁", "😐", "🙂", "😊"][Number(page.properties.mood) - 1] : "How I feel"}
        </Pressable></div>}
      {page.tags.length > 0 && (
        <div className="ws-tags">
          {page.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      )}
      {(page.type === "page" || pages.some((child) => child.parentId === page.id) || backlinks.length > 0) && (
        <div className="ws-page-links">
          <div className="ws-page-links-heading">
            <h3>Inside this page</h3>
            <Pressable
              className="ws-button"
              onClick={() =>
                void store
                  .createPage("page", "", { parentId: page.id })
                  .then((child) => onOpen(child.id))
                  .catch((cause) => onError(String(cause)))
              }
            >
              <Plus size={16} />
              Page
            </Pressable>
          </div>
          {pages
            .filter((child) => child.parentId === page.id)
            .map((child) => (
              <PageButton key={child.id} page={child} onOpen={onOpen} small />
            ))}
          {backlinks.length > 0 && (
            <>
              <h3>Backlinks</h3>
              {backlinks.map((link) => (
                <PageButton key={link.id} page={link} onOpen={onOpen} small />
              ))}
            </>
          )}
        </div>
      )}
      </details>}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Page options" onAfterClose={() => {
        if (openFormatting.current) { openFormatting.current = false; requestAnimationFrame(() => window.dispatchEvent(new Event("kimpor-editor-tools"))); }
      }}>
        {page.type !== "database" && <Pressable className="ws-button" onClick={() => { openFormatting.current = true; setMenuOpen(false); }}>Formatting</Pressable>}
        <div className="ws-page-menu">
          <Pressable className="ws-menu-row" onClick={() => void onPatch({ favorite: !page.favorite })}>
            <Star size={18} />{page.favorite ? "Unfavorite" : "Favorite"}
          </Pressable>
          {page.type === "journal" && (
        <div className="ws-journal-meta">
          <label>
            Date
            <input
              className="ws-inline-input"
              type="date"
              aria-label="Journal date"
              value={page.date ?? localDate()}
              onChange={(event) => void onPatch({ date: event.target.value })}
            />
          </label>
          <div className="ws-mood" aria-label="Mood">
            {moodNames.map((name, index) => (
              <Pressable
                key={name}
                className={page.properties.mood === index + 1 ? "selected" : ""}
                aria-label={name}
                aria-pressed={page.properties.mood === index + 1}
                onClick={() =>
                  void store.patchPageProperties(page.id, { mood: index + 1 }).catch(cause => onError(String(cause)))
                }
              >
                {["😔", "🙁", "😐", "🙂", "😊"][index]}
              </Pressable>
            ))}
          </div>
        </div>
      )}

          <p className="ws-help">Private access · {store.accountId === "local" ? "Saved in this browser." : "Only your signed-in account can access this workspace."} Sharing and public links are not available.</p>
          {page.type === "page" && <label className="ws-column-control"><input type="checkbox" checked={Boolean(page.properties.__template)} onChange={event => void store.patchPageProperties(page.id, { __template: event.target.checked }).catch(cause => onError(String(cause)))} />Use as a page template</label>}
          <Pressable className="ws-menu-row" onClick={() => { void flushEditors().then(() => store.archivePage(page.id)).then(() => { onNotify("Page archived"); setMenuOpen(false); }).catch(cause => onError(String(cause))); }}><Folder size={18} />Archive page</Pressable>
          <div className="ws-icon-picker" aria-label="Page icons">
            {icons.map((icon) => (
              <Pressable
                key={icon}
                aria-label={`Use ${icon} icon`}
                onClick={() => void onPatch({ icon })}
              >
                {icon}
              </Pressable>
            ))}
          </div>
          <label className="ws-field-label">
            Cover
            <select
              className="ws-input"
              value={page.cover}
              onChange={(event) => void onPatch({ cover: event.target.value })}
            >
              <option value="">No cover</option>
              <option value="blue">Ember gradient</option>
              <option value="purple">Purple gradient</option>
              <option value="warm">Warm gradient</option>
            </select>
          </label>
          <label className="ws-field-label">
            Tags (separate with commas)
            <input
              className="ws-input"
              defaultValue={page.tags.join(", ")}
              onBlur={(event) =>
                void onPatch({
                  tags: [
                    ...new Set(
                      event.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    ),
                  ],
                })
              }
            />
          </label>
          <label className="ws-field-label">
            Move to
            <select
              className="ws-input"
              value={page.parentId ?? ""}
              onChange={(event) => onMove(event.target.value || null)}
            >
              {page.type !== "row" && <option value="">Workspace root</option>}
              {pages
                .filter(
                  (item) =>
                    item.id !== page.id &&
                    item.type !== "row" &&
                    item.type !== "journal" &&
                    (page.type !== "row" || item.type === "database"),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {titleOf(item)}
                  </option>
                ))}
            </select>
          </label>
          <Pressable
            className="ws-menu-row"
            aria-pressed={page.fullWidth}
            onClick={() => void onPatch({ fullWidth: !page.fullWidth })}
          >
            <Columns3 size={18} />
            Full width{page.fullWidth && <Check size={18} />}
          </Pressable>
          <Pressable
            className="ws-menu-row"
            onClick={() => {
              onFocus();
              setMenuOpen(false);
            }}
          >
            <BookOpen size={18} />
            Focus mode
          </Pressable>
          <Pressable
            className="ws-menu-row"
            onClick={() => {
              setMenuOpen(false);
              setVersionsOpen(true);
            }}
          >
            <Clock3 size={18} />
            Version history
          </Pressable>
          <Pressable
            className="ws-menu-row"
            disabled={Boolean(page.properties.__locked)}
            onClick={() => {
              onDuplicate();
              setMenuOpen(false);
            }}
          >
            <FileText size={18} />
            Duplicate
          </Pressable>
          {["page", "note"].includes(page.type) && (
            <Pressable
              className="ws-menu-row"
              onClick={() => {
                void onPatch({ type: page.type === "note" ? "page" : "note" });
                setMenuOpen(false);
              }}
            >
              <FileText size={18} />
              Convert to {page.type === "note" ? "page" : "note"}
            </Pressable>
          )}
          <Pressable
            className="ws-menu-row ws-danger"
            onClick={() => {
              onTrash();
              setMenuOpen(false);
            }}
          >
            <Trash2 size={18} />
            Move to Trash
          </Pressable>
        </div>
      </Sheet>
      <Sheet
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        title="Version history"
      >
        <VersionHistory
          pageId={page.id}
          onNotify={onNotify}
          onError={onError}
        />
      </Sheet>
    </div>
  );
}

function VersionHistory({
  pageId,
  onNotify,
  onError,
}: {
  pageId: string;
  onNotify: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [versions, setVersions] = useState<{ id: string; createdAt: string }[]>(
    [],
  );
  useEffect(() => {
    void Promise.resolve(store.listVersions(pageId))
      .then(setVersions)
      .catch((cause) => onError(String(cause)));
  }, [pageId, onError]);
  return (
    <>
      <p className="ws-muted">
        Restore a saved document snapshot. The current document is preserved as
        another version.
      </p>
      {versions.length ? (
        versions.map((version) => (
          <div className="ws-trash-row" key={version.id}>
            <time>{new Date(version.createdAt).toLocaleString()}</time>
            <Pressable
              className="ws-button ws-tinted"
              onClick={() => {
                void requestConfirmation({title:"Restore this version?",description:"Your current document will be preserved.",confirmLabel:"Restore version"}).then(confirmed=>{if(confirmed)return store.restoreVersion(pageId,version.id).then(()=>onNotify("Version restored"));}).catch(cause=>onError(String(cause)));
              }}
            >
              Restore
            </Pressable>
          </div>
        ))
      ) : (
        <Empty title="No earlier versions yet">
          Snapshots appear as you edit your document.
        </Empty>
      )}
    </>
  );
}
