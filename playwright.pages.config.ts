import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const origin = new URL(process.env.BASE_URL ?? "http://127.0.0.1:4173").origin;
export default defineConfig({
  ...base,
  testMatch: "pages-databases.spec.ts",
  testIgnore: [],
  outputDir: "test-results/pages-matrix",
  reporter: [["list"]],
  projects: (["light", "dark"] as const).flatMap(theme => [
    { name: `pages-desktop-${theme}`, use: { browserName: "chromium" as const, viewport: { width: 1536, height: 864 } } },
    { name: `pages-ipad-${theme}`, use: { browserName: "webkit" as const, viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true } },
    { name: `pages-iphone-${theme}`, use: { browserName: "webkit" as const, viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } },
  ].map(project => ({
    ...project,
    use: {
      ...project.use,
      colorScheme: theme,
      serviceWorkers: "block" as const,
      storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: "velora-theme", value: theme }] }] },
    },
  }))),
});
