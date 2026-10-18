import { test, expect, type Page } from "@playwright/test";
import { leaveWriting } from "./workspace-actions";

test.setTimeout(90_000);
async function navigate(page: Page, name: string) {
  await leaveWriting(page);
  await page.getByRole("navigation", { name: page.viewportSize()!.width < 600 ? "Bottom navigation" : "Main navigation", exact: true }).getByRole("button", { name, exact: true }).click();
}
async function create(page: Page, kind: "Page" | "Database", title: string, configure?: () => Promise<void>) {
  await navigate(page, "Projects");
  await page.getByRole("button", { name: "Create page or database", exact: true }).click();
  await page.getByRole("menuitem", { name: `New ${kind.toLowerCase()}`, exact: true }).click();
  const sheet = page.getByRole("dialog", { name: `New ${kind.toLowerCase()}`, exact: true });
  await sheet.getByRole("textbox", { name: `${kind} name`, exact: true }).fill(title);
  await configure?.();
  await sheet.getByRole("button", { name: `Create ${kind.toLowerCase()}`, exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Page title", exact: true })).toHaveValue(title);
}
async function viewSettings(page: Page) {
  await page.getByRole("button", { name: "View options", exact: true }).click();
  await page.getByRole("menuitem", { name: "Layout and view settings", exact: true }).click();
  return page.getByRole("dialog", { name: "View settings", exact: true });
}
async function sidebar(page: Page) {
  const opener = page.getByRole("button", { name: "Open sidebar", exact: true });
  if (page.viewportSize()!.width < 600) await opener.click();
  else if (await opener.isVisible()) await opener.click();
  return page.getByRole("complementary", { name: "Sidebar", exact: true });
}

test("empty pages and searches explain the next step without an inactive action", async ({ page }) => {
  await page.goto("/");
  await navigate(page, "Notes");
  await expect(page.getByRole("heading", { name: "Your notes start here", exact: true })).toBeVisible();
  await expect(page.getByText("Ideas, checklists, and everything you want to keep.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Search workspace", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox", { name: "Search query", exact: true }).fill("Unfindable-sample-query");
  await expect(search.getByRole("heading", { name: "Nothing found yet", exact: true })).toBeVisible();
  await expect(search.getByText("Try another word, type, or date.", { exact: true })).toBeVisible();
  await expect(search.getByRole("button", { name: "Done", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("pages persist starter content, nesting, templates, favorites, archive and restore", async ({ page }, testInfo) => {
  await page.goto("/");
  await create(page, "Page", "Planning", async () => { await page.getByRole("combobox", { name: "Template", exact: true }).selectOption("meeting"); });
  const editor = page.getByRole("textbox", { name: "Document editor", exact: true });
  await expect(editor).toContainText("Agenda");
  await page.screenshot({ path: `docs/screenshots/page-starter-${testInfo.project.name}.png` });
  await editor.fill("Decisions from our planning meeting");
  await expect(page.locator(".rich-document")).toHaveCSS("font-size", "16px");
  await page.getByRole("button", { name: "Page options", exact: true }).click();
  let options = page.getByRole("dialog", { name: "Page options", exact: true });
  await expect(options).toContainText("Private access");
  await options.getByRole("button", { name: "Favorite", exact: true }).click();
  await options.getByLabel("Use as a page template", { exact: true }).click();
  await expect(options.getByLabel("Use as a page template", { exact: true })).toBeChecked();
  await options.getByRole("button", { name: "Close Page options", exact: true }).click();
  await create(page, "Page", "Nested plan", async () => {
    const sheet = page.getByRole("dialog", { name: "New page", exact: true });
    await sheet.getByRole("combobox", { name: "Inside", exact: true }).selectOption({ label: "Planning" });
    await sheet.getByRole("combobox", { name: "Template", exact: true }).selectOption({ label: "Planning" });
  });
  await expect(editor).toContainText("Decisions from our planning meeting");
  await page.screenshot({ path: `docs/screenshots/pages-${testInfo.project.name}.png` });
  await expect(page.locator(".ws-breadcrumb")).toContainText("Planning");
  await page.reload();
  await navigate(page, "Projects");
  await page.getByRole("button", { name: "Search projects", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search Projects", exact: true }).fill("Nested plan");
  await page.locator("main .ws-list-pane").getByRole("button", { name: /Nested plan/ }).click();
  await expect(editor).toContainText("Decisions from our planning meeting");
  await page.getByRole("button", { name: "Page options", exact: true }).click();
  options = page.getByRole("dialog", { name: "Page options", exact: true });
  await options.getByRole("button", { name: "Archive page", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Page title", exact: true })).toHaveCount(0);
  const nav = await sidebar(page);
  await nav.getByRole("button", { name: "Archive", exact: true }).click();
  const archive = page.getByRole("dialog", { name: "Archive", exact: true });
  await expect(archive).toContainText("Nested plan");
  await archive.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(archive).not.toContainText("Nested plan");
});

test("generic databases keep per-view visibility and selection after reload without becoming Today tasks", async ({ page }, testInfo) => {
  await page.goto("/");
  await create(page, "Database", "Books", async () => { await page.getByRole("combobox", { name: "Template", exact: true }).selectOption("reading"); });
  const input = page.getByRole("textbox", { name: "New item name", exact: true });
  await input.fill("A Wizard of Earthsea"); await input.press("Enter");
  await expect(page.getByRole("textbox", { name: "Row title", exact: true })).toHaveValue("A Wizard of Earthsea");
  await expect(page.getByRole("checkbox", { name: /^Complete / })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Author", exact: true }).fill("Ursula Le Guin");
  await expect(page.getByRole("button", { name: "Status", exact: true })).toContainText("To read");
  await page.screenshot({ path: `docs/screenshots/database-${testInfo.project.name}.png` });
  let settings = await viewSettings(page);
  await settings.getByLabel("Link", { exact: true }).click();
  await expect(settings.getByLabel("Link", { exact: true })).not.toBeChecked();
  await settings.getByRole("button", { name: "Close View settings", exact: true }).click();
  await expect(settings).not.toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Link/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Add view", exact: true }).click();
  await page.getByRole("menuitem", { name: "Gallery", exact: true }).click();
  await expect(page.locator(".ws-db-gallery")).toContainText("Ursula Le Guin");
  settings = await viewSettings(page);
  await settings.getByLabel("View name", { exact: true }).fill("Cards");
  await settings.getByLabel("Author", { exact: true }).click();
  await expect(settings.getByLabel("Author", { exact: true })).not.toBeChecked();
  await settings.getByRole("combobox", { name: "Group by", exact: true }).selectOption("status");
  await settings.getByRole("button", { name: "Rule", exact: true }).click();
  await settings.getByRole("combobox", { name: "Filter property", exact: true }).selectOption("author");
  await settings.getByRole("textbox", { name: "Filter value", exact: true }).fill("Ursula");
  await settings.getByRole("button", { name: "Add sort", exact: true }).click();
  await settings.getByRole("combobox", { name: "Sort property", exact: true }).selectOption("author");
  await settings.getByRole("combobox", { name: "Sort direction", exact: true }).selectOption("desc");
  await settings.getByRole("button", { name: "Close View settings", exact: true }).click();
  await expect(settings).not.toBeVisible();
  await expect(page.locator(".ws-db-gallery")).not.toContainText("Ursula Le Guin");
  await page.reload(); await navigate(page, "Projects");
  await page.getByRole("button", { name: "Search projects", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search Projects", exact: true }).fill("Books");
  await page.locator("main .ws-list-pane").getByRole("button", { name: /Books/ }).click();
  await expect(page.getByRole("tab", { name: "Cards", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".ws-db-gallery")).not.toContainText("Ursula Le Guin");
  settings = await viewSettings(page);
  await expect(settings.getByRole("combobox", { name: "Group by", exact: true })).toHaveValue("status");
  await expect(settings.getByRole("combobox", { name: "Filter property", exact: true })).toHaveValue("author");
  await expect(settings.getByRole("textbox", { name: "Filter value", exact: true })).toHaveValue("Ursula");
  await expect(settings.getByRole("combobox", { name: "Sort property", exact: true })).toHaveValue("author");
  await expect(settings.getByRole("combobox", { name: "Sort direction", exact: true })).toHaveValue("desc");
  await settings.getByRole("combobox", { name: "Group by", exact: true }).selectOption("");
  await settings.getByRole("button", { name: "Add property", exact: true }).click();
  const schema = page.getByRole("dialog", { name: "Database properties", exact: true });
  await schema.getByRole("button", { name: "Remove Author property", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Remove Author?", exact: true }).getByRole("button", { name: "Remove property", exact: true }).click();
  await expect(schema.locator(".ws-property-list")).not.toContainText("Author");
  await schema.getByRole("button", { name: "Close Database properties", exact: true }).click();
  await expect(settings.getByRole("combobox", { name: "Filter property", exact: true })).toHaveCount(0);
  await expect(settings.getByRole("combobox", { name: "Sort property", exact: true })).toHaveCount(0);
  await settings.getByRole("button", { name: "Close View settings", exact: true }).click();
  await expect(settings).not.toBeVisible();
  await page.getByRole("tab", { name: "Table", exact: true }).click();
  await expect(page.getByRole("columnheader", { name: /Author/ })).toHaveCount(0);
  await expect(page.getByRole("columnheader", { name: /Link/ })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Row title", exact: true })).toHaveValue("A Wizard of Earthsea");
  await navigate(page, "Today");
  await expect(page.locator(".ws-task-card").filter({ hasText: "A Wizard of Earthsea" })).toHaveCount(0);
  await expect(page.locator(".today-schedule, .ws-schedule")).toHaveCount(0);
});

test("settings use the fixed text size and generic list items have no task completion control", async ({ page }) => {
  await page.goto("/");
  const nav = await sidebar(page);
  await nav.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(settings.getByLabel("Text size", { exact: true })).toHaveCount(0);
  await settings.getByRole("button", { name: "Close Settings", exact: true }).click();
  const closer = page.getByRole("button", { name: "Close sidebar", exact: true }).filter({ visible: true }).first();
  if (await closer.isVisible()) await closer.click();
  await create(page, "Database", "Directory", async () => {
    await page.getByRole("combobox", { name: "Template", exact: true }).selectOption("contacts");
    await page.getByRole("combobox", { name: "First view", exact: true }).selectOption("list");
  });
  await page.getByRole("button", { name: "New item", exact: true }).filter({ visible: true }).click();
  await expect(page.locator('.ws-page-detail[data-page-type="row"]')).toBeVisible();
  await page.getByRole("textbox", { name: "Page title", exact: true }).fill("Ada");
  await page.getByRole("textbox", { name: "Contact", exact: true }).fill("ada@example.com");
  await page.locator(".ws-detail-back").click();
  await expect(page.locator(".ws-db-list")).toContainText("Ada");
  await expect(page.locator(".ws-db-list")).toContainText("ada@example.com");
  await expect(page.locator(".ws-db-list").getByRole("checkbox")).toHaveCount(0);
});
