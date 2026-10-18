import { afterEach, expect, it, vi } from "vitest";
import { disablePush, getPushState } from "./notifications";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function browser(permission: NotificationPermission, registration?: unknown) {
  vi.stubGlobal("window", { PushManager: class {}, Notification: class {} });
  vi.stubGlobal("Notification", { permission });
  const getRegistration = vi.fn(async () => registration);
  vi.stubGlobal("navigator", { serviceWorker: { getRegistration } });
  return getRegistration;
}
it("shows the real existing subscription even when this build has no registration key", async () => {
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
  browser("granted", { active: {}, pushManager: { getSubscription: async () => ({ endpoint: "fixture" }) } });
  expect(await getPushState()).toMatchObject({ enabled: true, available: true });
});
it("explains denied notification permission without querying service workers", async () => {
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "fixture");
  const registration = browser("denied");
  registration.mockImplementation(() => { throw new Error("Unexpected service-worker lookup"); });
  expect(await getPushState()).toMatchObject({ enabled: false, available: false, message: expect.stringContaining("Permission denied") });
  expect(registration).not.toHaveBeenCalled();
});
it("explains unconfigured default permission without querying service workers", async () => {
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
  const registration = browser("default");
  registration.mockImplementation(() => { throw new Error("Unexpected service-worker lookup"); });
  expect(await getPushState()).toMatchObject({ enabled: false, available: false, message: expect.stringContaining("not configured") });
  expect(registration).not.toHaveBeenCalled();
});
it("does not wait on serviceWorker.ready when no registration exists", async () => {
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "fixture");
  const registration = browser("default");
  expect(await getPushState()).toMatchObject({ enabled: false, available: false, message: expect.stringContaining("Install the app") });
  await disablePush();
  expect(registration).toHaveBeenCalledTimes(2);
});
it("explains browsers without web push", async () => {
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("window", {});
  expect(await getPushState()).toMatchObject({ enabled: false, available: false, message: expect.stringContaining("does not support") });
});
