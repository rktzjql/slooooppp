// Platform boundary retained at its original path to avoid changing feature code.
import { App } from "@capacitor/app";
import { Share } from "@capacitor/share";
import { Clipboard } from "@capacitor/clipboard";
import { Preferences } from "@capacitor/preferences";
import { androidRuntime, localRuntime } from "../runtime";
import { request, setToken, setAnonymousToken, configureSessionRecovery } from "../api/client";
import { AndroidLogin, SessionResult } from "@aimi/contracts";

// The new backend must bind this random credential to an anonymous account.
// It must never accept a client-supplied user ID as authentication.
async function androidSession() {
  const key = "aimi.android.installation-secret";
  let { value } = await Preferences.get({ key });
  if (!value) {
    value = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join("");
    await Preferences.set({ key, value });
  }
  return SessionResult.parse(await request("/auth/android", "POST", AndroidLogin.parse({ installationSecret: value }))).token;
}
if (androidRuntime) configureSessionRecovery(androidSession);
let pending: Promise<void> | undefined;
export async function login(name = "player") {
  if (localRuntime) {
    const result = await request<{ token: string }>("/auth/local", "POST", { name });
    setToken(result.token);
    return;
  }
  if (!pending) pending = androidSession().then(setAnonymousToken).finally(() => { pending = undefined; });
  return pending;
}
export async function copy(text: string) {
  if (androidRuntime) await Clipboard.write({ string: text });
  else await navigator.clipboard.writeText(text);
}
export async function invite(code: string) {
  if (androidRuntime) await Share.share({ title: "AIMI", text: "AIMI에서 함께 정원을 꾸며요! 친구 코드: " + code });
  else await copy(code);
}
export function hostNavigation(back: () => void) {
  if (!androidRuntime) return () => {};
  const listener = App.addListener("backButton", back);
  return () => { void listener.then(handle => handle.remove()); };
}
export function updateNavigation(_hasBack: boolean) {}
export function exit() { if (androidRuntime) void App.exitApp(); }
