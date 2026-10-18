import { leaveWriting } from './workspace-actions';
import { test, expect, type Page } from "@playwright/test";
async function navigate(page: Page, name: string) {
  await leaveWriting(page);
  const nav = page.getByRole("navigation", { name: page.viewportSize()!.width < 600 ? "Bottom navigation" : "Main navigation", exact: true });
  await nav.getByRole("button", { name, exact: true }).click();
}
test("project creation preserves each preset schema and checklist", async ({ page }) => {
  await page.goto("/");
  for (const [label, count] of [["Weekly report", 4], ["Rework list", 0], ["App build", 0], ["Coursework", 0], ["Model tracking", 2]] as const) {
    await navigate(page, "Projects");
    await page.getByRole("button", { name: "New project", exact: true }).click();
    const dialog=page.getByRole("dialog", { name: "New project" });
    await dialog.getByRole("button", { name: label, exact: true }).click();
    await expect(dialog.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed","true");
    await dialog.getByRole("button", { name: "Create project", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Page title" })).toHaveValue(label);
    await expect(page.getByRole("tab", { name: "All tasks", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".ws-db-count")).toContainText(`${count} items`);
    await expect(page.getByRole("button", { name: "New task", exact: true }).filter({ visible: true })).toBeVisible();
  }
});
test("quick add focuses the task name and completion moves the task to Done", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await page.keyboard.press("Control+n");
  const sheet = page.getByRole("dialog", { name: "New task", exact: true });
  const name = sheet.getByRole("textbox", { name: "Task name" });
  await expect(name).toBeFocused();
  await expect(sheet.getByLabel("Date", { exact: true })).toBeHidden();
  await name.fill("Plan the next step");
  await sheet.getByRole("button", { name: "Add task" }).click();
  const row = page.locator(".ws-task-card").filter({ hasText: "Plan the next step" });
  await expect(row.locator("strong")).toHaveText("Plan the next step");
  const sizes = await row.evaluate(element => ({ name: parseFloat(getComputedStyle(element.querySelector("strong")!).fontSize), meta: parseFloat(getComputedStyle(element.querySelector(".ws-task-card-meta")!).fontSize) }));
  expect(sizes.name).toBeGreaterThan(sizes.meta);
  await row.getByRole("checkbox", { name: "Complete Plan the next step" }).click();
  await page.getByRole("button", { name: /^Done 1$/ }).click();
  await expect(page.locator(".ws-task-card strong")).toHaveText("Plan the next step");
  await navigate(page, "Projects");
  await expect(page.getByRole("button", { name: /Inbox/ }).filter({ visible: true }).first()).toBeVisible();
});

test("project landing views, custom creation and keyboard board moves work", async ({page}) => {
  await page.goto("/"); await navigate(page,"Projects");
  await expect(page.getByRole("tab",{name:"Gallery",exact:true})).toHaveAttribute("aria-selected","true");
  await page.getByRole("button",{name:"New project",exact:true}).click();
  const form=page.getByRole("dialog",{name:"New project",exact:true});
  await form.getByRole("textbox",{name:"Project name",exact:true}).fill("Launch workspace");
  await form.getByRole("button",{name:"App build",exact:true}).click();
  await form.getByRole("button",{name:"Use 🎯 icon",exact:true}).click();
  await form.getByRole("button",{name:"Create project",exact:true}).click();
  await expect(page.getByRole("textbox",{name:"Page title",exact:true})).toHaveValue("Launch workspace");
  await expect(page.getByRole("button",{name:"Change page icon",exact:true})).toHaveText("🎯");
  const inline=page.getByRole("textbox",{name:"New task name",exact:true});
  await inline.fill("Ship landing"); await inline.press("Enter");
  const title=page.getByRole("textbox",{name:"Row title",exact:true});
  await expect(title).toHaveValue("Ship landing"); await title.focus(); await title.fill("Revert this"); await title.press("Escape");
  await expect(title).toHaveValue("Ship landing");
  await title.focus(); await title.dispatchEvent("keydown",{key:"Enter",isComposing:true}); await expect(title).toBeFocused();
  await title.press("Enter"); await expect(title).not.toBeFocused();
  if(page.viewportSize()!.width>=600){const resize=page.getByRole("separator",{name:"Resize Task name column",exact:true});await resize.focus();await resize.press("ArrowRight");expect(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith("velora-column-widths-")))).toBe(true);}
  await page.getByRole("tab",{name:"By status",exact:true}).click();
  await page.getByRole("button",{name:"Move Ship landing to",exact:true}).click();
  await page.getByRole("menuitem",{name:"Testing",exact:true}).click();
  await expect(page.locator(".ws-board-column").filter({has:page.getByRole("heading",{name:/Testing/})})).toContainText("Ship landing");
  await navigate(page,"Projects");
  for(const name of ["Table","Board","Gallery"]){await page.getByRole("tab",{name,exact:true}).click();await expect(page.getByRole("tabpanel",{name,exact:true})).toContainText("Launch workspace");}
  expect(await page.locator(".ws-project-card").first().evaluate(card=>!card.querySelector("button button"))).toBe(true);
  await page.getByRole("button",{name:"Filter projects",exact:true}).click();await page.getByRole("menuitem",{name:"Coursework",exact:true}).click();
  await expect(page.getByRole("tabpanel",{name:"Gallery",exact:true})).not.toContainText("Launch workspace");
});

test("imported project view and property identities render without schema writes",async({page})=>{
  await page.goto("/");await expect(page.getByRole("heading",{name:"Today",exact:true})).toBeVisible();
  const original=await page.evaluate(async()=>{
    const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open("veloradesk-workspace");request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const date="2026-10-01T00:00:00.000Z",clock={wall:1790812800000,counter:0,node:"imported-fixture"};
    const page={id:"imported-ledger",userId:"local",type:"database",title:"Imported ledger",parentId:null,favorite:false,tags:[],icon:"📋",cover:"",fullWidth:false,date:null,databaseId:null,properties:{__projectType:"app"},createdAt:date,updatedAt:date,deletedAt:null};
    const definition={id:page.id,userId:"local",properties:[{id:"source-name",name:"Original name",type:"title"},{id:"source-stage",name:"Stage",type:"status",options:["Idea","Building","Shipped"]},{id:"source-budget",name:"Budget",type:"number"}],views:[{id:"source-table",name:"Imported details",type:"table"},{id:"source-board",name:"Imported stages",type:"board",groupBy:"source-stage"}],createdAt:date,updatedAt:date,deletedAt:null};
    const row={...page,id:"imported-row",type:"row",title:"Preserved item",parentId:page.id,databaseId:page.id,properties:{"source-stage":"Building","source-budget":7.5}};
    const entity=(table:string,value:typeof page|typeof row|typeof definition)=>({userId:"local",table,id:value.id,fields:Object.fromEntries(Object.entries(value).map(([key,value])=>[key,{value,clock}])),schemaVersion:1});
    const record=entity("databases",definition);
    await new Promise<void>((resolve,reject)=>{const transaction=database.transaction("entities","readwrite"),store=transaction.objectStore("entities");for(const value of [entity("pages",page),entity("pages",row),record])store.put(value);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);});database.close();return record;
  });
  await page.reload();await navigate(page,"Projects");await page.getByRole("button",{name:"Open Imported ledger",exact:true}).click();
  await expect(page.getByRole("tab",{name:"Imported details",exact:true})).toHaveAttribute("aria-selected","true");
  await expect(page.getByRole("spinbutton",{name:"Budget",exact:true})).toHaveValue("7.5");
  await page.getByRole("tab",{name:"Imported stages",exact:true}).click();await expect(page.locator(".ws-db-board")).toContainText("Preserved item");
  const after=await page.evaluate(async()=>{const database=await new Promise<IDBDatabase>(resolve=>{const request=indexedDB.open("veloradesk-workspace");request.onsuccess=()=>resolve(request.result);});return await new Promise<unknown>((resolve,reject)=>{const request=database.transaction("entities").objectStore("entities").get(["local","databases","imported-ledger"]);request.onsuccess=()=>{database.close();resolve(request.result);};request.onerror=()=>reject(request.error);});});
  expect(after).toEqual(original);
});

test("row properties add a schema field in side peek or the narrow full page",async({page})=>{
  await page.goto("/");await navigate(page,"Projects");
  await page.getByRole("button",{name:"New project",exact:true}).click();
  await page.getByRole("dialog",{name:"New project",exact:true}).getByRole("button",{name:"Create project",exact:true}).click();
  const inline=page.getByRole("textbox",{name:"New task name",exact:true});await inline.fill("Peek notes");await inline.press("Enter");
  await page.getByRole("button",{name:"Open Peek notes",exact:true}).click();
  const peek=page.getByRole("dialog",{name:"Item",exact:true});
  const wide=(await page.locator(".ws-main").evaluate(element=>element.clientWidth))>=1280;
  if(wide)await expect(peek).toBeVisible();else await expect(page.getByRole("textbox",{name:"Page title",exact:true})).toHaveValue("Peek notes");
  await page.getByRole("button",{name:"Add a property",exact:true}).click();
  const form=page.getByRole("dialog",{name:"Add property",exact:true});
  await form.getByRole("textbox",{name:"Property name",exact:true}).fill("Priority note");
  await form.getByRole("button",{name:"Add property",exact:true}).click();
  await expect(form).not.toBeVisible();
  await page.getByRole("textbox",{name:"Priority note",exact:true}).fill("Keep the same row");
  if(wide)await peek.getByRole("button",{name:"Close item",exact:true}).click();else await page.locator(".ws-detail-back").click();
  await expect(page.getByRole("columnheader",{name:/Priority note/})).toBeVisible();
  await expect(page.getByRole("textbox",{name:"Priority note",exact:true})).toHaveValue("Keep the same row");
});
