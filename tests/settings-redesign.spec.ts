import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openSettings(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  if (page.viewportSize()!.width < 600) await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  return page.getByRole("dialog", { name: "Settings", exact: true });
}
for (const theme of ["light", "dark"] as const) test(`settings categories, appearance and accessibility in ${theme}`, async ({ page }) => {
  await page.addInitScript(value => localStorage.setItem("velora-theme", value), theme);
  const dialog = await openSettings(page), phone = page.viewportSize()!.width < 600;
  const search = dialog.getByRole("searchbox", { name: "Search settings", exact: true });
  await search.fill("motion");
  await expect(dialog.getByRole("button", { name: "Appearance", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "My account", exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Appearance", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("heading", { name: "Appearance", exact: true })).toBeFocused();
  await expect(dialog.getByRole("button", { name: theme === "dark" ? "Dark" : "Light", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("group", { name: "Accent", exact: true }).getByRole("button")).toHaveCount(6);
  await dialog.getByRole("button", { name: "Purple accent", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "purple");
  await dialog.getByRole("button", { name: "Compact", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await dialog.getByRole("switch", { name: "Reduce motion", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "true");
  await expect(dialog.getByLabel("Text size", { exact: true })).toHaveCount(0);
  expect(await page.locator("html").evaluate(element => getComputedStyle(element).getPropertyValue("--text-body").trim())).toBe("16px");
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const axe = await new AxeBuilder({ page }).include(".settings-dialog").analyze();
  expect(axe.violations.filter(item => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  if (phone) {
    await expect(dialog.getByRole("navigation", { name: "Settings categories" })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Back to settings", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Appearance", exact: true })).toBeFocused();
    await expect(dialog.getByRole("searchbox", { name: "Search settings" })).toHaveValue("motion");
  }
  await dialog.getByRole("button", { name: "Close Settings", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeFocused();
});

test("settings search and data panel have one complete set of controls", async ({ page }) => {
  const dialog = await openSettings(page);
  const search = dialog.getByRole("searchbox", { name: "Search settings" });
  await search.fill("missing category ខ្មែរ");
  await expect(dialog.getByText("No settings found.", { exact: true })).toBeVisible();
  await search.fill("backup");
  await dialog.getByRole("button", { name: "Import & export", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Export JSON", exact: true })).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "Export ZIP", exact: true })).toHaveCount(1);
  await expect(dialog.getByRole("button", { name: "Import", exact: true })).toHaveCount(1);
  await expect(dialog.getByLabel("Import portable files", { exact: true })).toHaveAttribute("accept", ".json,.md,.markdown,.csv,.zip");
  await expect(dialog.getByText("More", { exact: true })).toHaveCount(0);
});

test("background notifications resolve without an active service worker", async ({ page }) => {
  const dialog = await openSettings(page);
  await dialog.getByRole("button", { name: "Notifications", exact: true }).click();
  const toggle = dialog.getByRole("switch", { name: "Background notifications", exact: true });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(dialog.locator("#settings-push-status")).not.toHaveText("Checking notification status…");
  await expect(toggle).toBeDisabled();
});

test("settings hands off to Calendars on first visit and to Trash", async ({ page }) => {
  let dialog = await openSettings(page);
  await dialog.getByRole("button", { name: "Calendars", exact: true }).click();
  await dialog.getByRole("button", { name: "Open calendar settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Connected accounts", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close calendar settings", exact: true }).click();
  if (page.viewportSize()!.width < 600) await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await dialog.getByRole("button", { name: /^Trash\b/ }).click();
  await dialog.getByRole("button", { name: "Open Trash", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Trash", exact: true })).toBeVisible();
  await expect(page.getByText("Trash is empty", { exact: true })).toBeVisible();
});
