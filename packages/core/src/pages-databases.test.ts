import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import * as Y from "yjs";
import { WorkspaceStore, type SyncChange } from "./store";
import type { DatabaseDefinition } from "./model";
import { inferProjectTypes, projectType } from "./projects";
import { decryptAttachment, encryptAttachment } from "./crypto";

const stores: WorkspaceStore[] = [];
async function workspace(name = `pages-${crypto.randomUUID()}`, owner = "owner") {
  const store = new WorkspaceStore(name,owner); stores.push(store); await store.ready(); return store;
}
afterEach(async () => {
  const names = new Set(stores.map(store => store.db.name));
  for (const store of stores) await store.close();
  for (const name of names) await stores.find(store => store.db.name === name)!.db.delete();
  stores.length = 0;
});
const definition = () => ({ properties: [
  { id:"title",name:"Name",type:"title" as const },
  { id:"status",name:"Status",type:"status" as const,options:["Open","Done"] },
  { id:"person",name:"Assignee",type:"person" as const },
], views:[{ id:"table",name:"All",type:"table" as const },{ id:"board",name:"Status",type:"board" as const,groupBy:"status" }],
defaultProperties:{ status:"Open",person:["Alex"] } });

it("moves nested pages and rows safely, rejecting cycles and foreign or missing destinations", async () => {
  const store = await workspace();
  const root = await store.createPage("page","Root");
  const child = await store.createPage("page","Child",{ parentId:root.id });
  await expect(store.movePage(root.id,child.id)).rejects.toThrow("descendants");
  await expect(store.patchPage(root.id,{parentId:child.id})).rejects.toThrow("descendants");
  await expect(store.movePage(child.id,"missing")).rejects.toThrow("Destination");
  const other = await workspace(store.db.name,"other");
  const foreign = await other.createPage("page","Private");
  await expect(store.movePage(child.id,foreign.id)).rejects.toThrow("Destination");
  await expect(other.movePage(child.id,null)).rejects.toThrow("no longer exists");
  const first = await store.createDatabase("First",definition());
  const second = await store.createDatabase("Second",definition());
  await store.movePage(child.id,first.id);
  expect(store.listPages().find(page => page.id === child.id)).toMatchObject({type:"row",parentId:first.id,databaseId:first.id});
  await store.movePage(child.id,second.id);
  expect(store.listPages().find(page => page.id === child.id)?.databaseId).toBe(second.id);
  await expect(store.movePage(child.id,root.id)).rejects.toThrow("database destination");
  await store.archivePage(second.id);
  await expect(store.movePage(root.id,second.id)).rejects.toThrow("Restore");
  expect(other.listPages().map(page => page.id)).toEqual([foreign.id]);
});

it("keeps archive separate from Trash across reloads and preserves it in backups", async () => {
  const store = await workspace();
  const page = await store.createPage("page","Archived");
  await store.createPage("note","Nested",{parentId:page.id});
  await store.archivePage(page.id);
  expect(store.listPages()).toEqual([]);
  expect(store.listPages(false,true)).toHaveLength(2);
  expect(store.listPages(true)).toHaveLength(2);
  const reopened = await workspace(store.db.name);
  expect(reopened.listPages()).toEqual([]);
  expect(JSON.parse(await reopened.exportData()).entities).toHaveLength(2);
  await reopened.trashPage(page.id);
  expect(reopened.listPages(false,true)).toEqual([]);
  await reopened.restorePage(page.id);
  expect(reopened.listPages()).toEqual([]);
  await reopened.unarchivePage(page.id);
  expect(reopened.listPages()).toHaveLength(2);
});

it("patches independent page properties without clearing template flags or concurrent row edits", async () => {
  const a = await workspace(), b = await workspace();
  const page = await a.createPage("page","Template",{properties:{status:"Open",extra:"Keep"}});
  await b.applyRemote(await a.pendingChanges(),"initial");
  await a.acknowledge((await a.pendingChanges()).map(change => change.id));
  await Promise.all([a.patchPageProperties(page.id,{__template:true}),a.patchPageProperties(page.id,{__text:"Delayed editor text"})]);
  await b.patchPageProperties(page.id,{status:"Done"});
  const left = await a.pendingChanges(), right = await b.pendingChanges();
  await a.applyRemote(right,"right"); await b.applyRemote(left,"left");
  for (const store of [a,b]) expect(store.listPages()[0]?.properties).toMatchObject({__template:true,__text:"Delayed editor text",status:"Done",extra:"Keep"});
  await expect(a.patchPageProperties(page.id,JSON.parse('{"__proto__":true}'))).rejects.toThrow("Invalid page property");
  await expect(a.patchPageProperties(page.id,{bad:{} as never})).rejects.toThrow("Invalid page property");
  await expect(a.patchPageProperties(page.id,{__locked:false})).rejects.toThrow("Invalid page property");
  await a.patchPage(page.id,{properties:{__locked:true}});
  await expect(a.patchPageProperties(page.id,{__text:"Private"})).rejects.toThrow("Unlock");
});

it("creates databases atomically and applies detached row defaults with explicit overrides", async () => {
  const store = await workspace();
  await expect(store.createDatabase("Invalid",{...definition(),views:[{id:"bad",name:"Bad",type:"table",visibleProperties:["missing"]}]})).rejects.toThrow("reference");
  expect(store.listPages(true)).toEqual([]);
  expect(await store.pendingChanges()).toEqual([]);
  const database = await store.createDatabase("Generic",definition(),{properties:{__workspaceDatabase:true}});
  const first = await store.createPage("row","First",{databaseId:database.id});
  const second = await store.createPage("row","Second",{databaseId:database.id,properties:{status:"Done"}});
  expect(first.properties).toMatchObject({status:"Open",person:["Alex"]});
  expect(second.properties.status).toBe("Done");
  (first.properties.person as string[]).push("Changed locally");
  expect(store.listDatabases()[0]?.defaultProperties?.person).toEqual(["Alex"]);
  expect(projectType(database,{[database.id]:"app"})).toBeUndefined();
  expect(inferProjectTypes(store.listPages(),store.listDatabases())).toEqual({});
});

it("duplicates database subtrees with independent documents, attachments and template flags", async () => {
  const store = await workspace();
  const database = await store.createDatabase("Library",definition(),{properties:{__template:true,__workspaceDatabase:true}});
  const row = await store.createPage("row","Entry",{parentId:database.id,databaseId:database.id});
  const nested = await store.createPage("note","Nested",{parentId:row.id});
  const file = await store.saveAttachmentBytes(row.id,new TextEncoder().encode("file"),"example.txt");
  const schema = store.listDatabases()[0]!;
  await store.saveDatabase({...schema,properties:[...schema.properties,{id:"related",name:"Related",type:"relation",relationDatabaseId:database.id},{id:"file",name:"File",type:"files"},{id:"text",name:"Text",type:"text"}]});
  await store.patchPage(row.id,{cover:`attachment:${file.id}`,properties:{...row.properties,related:[nested.id],file:[file.id],text:nested.id}});
  const doc = new Y.Doc();
  const element = new Y.XmlElement("file"); element.setAttribute("attachmentId",file.id); element.setAttribute("src",`attachment:${file.id}`);
  doc.getXmlFragment("default").insert(0,[element]);
  await store.saveDoc(row.id,Y.encodeStateAsUpdate(doc)); doc.destroy();
  const clone = await store.duplicatePage(database.id);
  expect(clone).toMatchObject({title:"Library copy",properties:{__template:false,__workspaceDatabase:true}});
  const clonedRow = store.listPages().find(page => page.databaseId === clone.id)!;
  expect(clonedRow).toMatchObject({title:"Entry",parentId:clone.id});
  expect(store.listPages().find(page => page.parentId === clonedRow.id)?.title).toBe(nested.title);
  expect(store.listDatabases().find(item => item.id === clone.id)?.defaultProperties).toEqual(definition().defaultProperties);
  const [attachment] = await store.listAttachments(clonedRow.id);
  expect(attachment?.id).not.toBe(file.id); expect(attachment?.bytes).toEqual(file.bytes);
  const clonedNested = store.listPages().find(page => page.parentId === clonedRow.id)!;
  expect(clonedRow.properties).toMatchObject({related:[clonedNested.id],file:[attachment!.id],text:nested.id});
  expect(clonedRow.cover).toBe(`attachment:${attachment!.id}`);
  expect(store.listDatabases().find(item => item.id === clone.id)?.properties.find(property => property.id === "related")?.relationDatabaseId).toBe(clone.id);
  const body = new Y.Doc(); Y.applyUpdate(body,(await store.loadDoc(clonedRow.id))!);
  const clonedElement = body.getXmlFragment("default").get(0) as Y.XmlElement;
  expect(clonedElement.getAttribute("attachmentId")).toBe(attachment?.id);
  expect(clonedElement.getAttribute("src")).toBe(`attachment:${attachment?.id}`); body.destroy();
  await store.patchPage(row.id,{properties:{...row.properties,__locked:true}});
  const count = store.listPages(true).length;
  await expect(store.duplicatePage(database.id)).rejects.toThrow("Unlock");
  expect(store.listPages(true)).toHaveLength(count);
});

it("re-encrypts cloned attachments for their new IDs and keeps them readable after the source is purged", async () => {
  const store = await workspace(undefined,"local");
  const page = await store.createPage("page","Encrypted file");
  const id = crypto.randomUUID(), plaintext = new TextEncoder().encode("Private attachment content ខ្មែរ");
  const encrypted = await encryptAttachment(plaintext,id);
  await store.saveAttachmentBytes(page.id,encrypted.bytes,"Encrypted attachment",id);
  const document = new Y.Doc(), image = new Y.XmlElement("image");
  image.setAttribute("attachmentId",id); image.setAttribute("fileKey",encrypted.key); image.setAttribute("fileIv",encrypted.iv); image.setAttribute("src",`attachment:${id}`);
  document.getXmlFragment("default").insert(0,[image]);
  await store.saveDoc(page.id,Y.encodeStateAsUpdate(document)); document.destroy();
  const clone = await store.duplicatePage(page.id);
  const body = new Y.Doc(); Y.applyUpdate(body,(await store.loadDoc(clone.id))!);
  const clonedImage = body.getXmlFragment("default").get(0) as Y.XmlElement;
  const clonedId = clonedImage.getAttribute("attachmentId")!;
  const key = clonedImage.getAttribute("fileKey")!, iv = clonedImage.getAttribute("fileIv")!;
  expect(clonedId).not.toBe(id); expect(key).not.toBe(encrypted.key); expect(iv).not.toBe(encrypted.iv);
  expect(clonedImage.getAttribute("src")).toBe(`attachment:${clonedId}`);
  await store.trashPage(page.id); await store.purgePages([page.id]);
  expect(await store.getAttachment(id)).toBeNull();
  const copied = (await store.getAttachment(clonedId))!;
  expect(copied.bytes).not.toEqual(encrypted.bytes);
  expect(await decryptAttachment(copied.bytes,key,iv,clonedId)).toEqual(plaintext);
  body.destroy();
  const missingKeys = await store.createPage("page","Missing keys");
  await store.saveAttachmentBytes(missingKeys.id,encrypted.bytes,"Encrypted attachment");
  const count = store.listPages().length;
  await expect(store.duplicatePage(missingKeys.id)).rejects.toThrow("keys are missing");
  expect(store.listPages()).toHaveLength(count);
});

it("merges concurrent view attributes without losing other views, preserving legacy array records", async () => {
  const a = await workspace(), b = await workspace();
  const page = await a.createDatabase("Shared",definition());
  await b.applyRemote(await a.pendingChanges(),"initial");
  const base = await a.pendingChanges();
  await a.acknowledge(base.map(change => change.id));
  await a.patchDatabaseView(page.id,"table",{name:"Renamed",visibleProperties:["title","person"]});
  await b.patchDatabaseView(page.id,"table",{sort:[{property:"status",direction:"desc"}]});
  await b.patchDatabaseView(page.id,"board",{name:"By status"});
  const left = await a.pendingChanges(), right = await b.pendingChanges();
  await a.applyRemote(right,"right"); await b.applyRemote(left,"left");
  expect(a.listDatabases()).toEqual(b.listDatabases());
  expect(a.listDatabases()[0]?.views.find(view => view.id === "table")).toMatchObject({name:"Renamed",visibleProperties:["title","person"],sort:[{property:"status",direction:"desc"}]});
  await expect(a.patchDatabaseView(page.id,"table",{groupBy:"missing"})).rejects.toThrow("reference");
  await a.patchDatabaseView(page.id,"board",{groupBy:""});
  expect(a.listDatabases()[0]?.views.find(view => view.id === "board")?.groupBy).toBe("");
  await a.deleteDatabaseView(page.id,"board");
  expect(a.listDatabases()[0]?.views.map(view => view.id)).toEqual(["table"]);
  const legacy = await workspace();
  const database = a.listDatabases()[0]!;
  const clock = {wall:Date.now(),counter:0,node:"legacy"};
  const change: SyncChange = {id:crypto.randomUUID(),userId:"owner",kind:"entity",entityId:page.id,table:"databases",schemaVersion:1,
    fields:Object.fromEntries(Object.entries({...database,views:definition().views}).map(([name,value]) => [name,{value,clock}]))};
  await legacy.applyRemote([change],"legacy");
  await legacy.patchDatabaseView(page.id,"board",{name:"Legacy view updated"});
  expect(legacy.listDatabases()[0]?.views).toHaveLength(2);
  const reopened = await workspace(legacy.db.name);
  expect(reopened.listDatabases()[0]?.views.find(view => view.id === "board")?.name).toBe("Legacy view updated");
  const invalid: DatabaseDefinition = {...database,defaultProperties:{missing:"bad"}};
  await expect(legacy.saveDatabase(invalid)).rejects.toThrow("reference");
});

it("makes concurrent view deletion deterministic in either delivery order and permits complete recreation", async () => {
  const a = await workspace(), b = await workspace();
  const page = await a.createDatabase("Views",definition());
  const base = await a.pendingChanges();
  await b.applyRemote(base,"base");
  await a.acknowledge((await a.pendingChanges()).map(change => change.id));
  await a.deleteDatabaseView(page.id,"board");
  await b.patchDatabaseView(page.id,"board",{name:"Concurrent rename"});
  const deletion = await a.pendingChanges(), rename = await b.pendingChanges();
  const forward = await workspace(), reverse = await workspace();
  await forward.applyRemote(base,"base"); await reverse.applyRemote(base,"base");
  await forward.applyRemote([...deletion,...rename],"changes");
  await reverse.applyRemote([...rename,...deletion],"changes");
  await a.applyRemote(rename,"rename"); await b.applyRemote(deletion,"deletion");
  expect(forward.listDatabases()).toEqual(reverse.listDatabases());
  expect(forward.listDatabases()[0]?.views.some(view => view.id === "board")).toBe(false);
  expect(a.listDatabases()[0]?.views.some(view => view.id === "board")).toBe(false);
  expect(b.listDatabases()[0]?.views.some(view => view.id === "board")).toBe(false);
  // Patching a deleted view cannot accidentally resurrect a stale partial form.
  await expect(a.patchDatabaseView(page.id,"board",{name:"Stale"})).rejects.toThrow("View no longer exists");
  await a.patchDatabaseView(page.id,"board",{name:"Recreated",type:"board",groupBy:"status"});
  expect(a.listDatabases()[0]?.views.find(view => view.id === "board")).toMatchObject({id:"board",name:"Recreated",type:"board",groupBy:"status"});
});
