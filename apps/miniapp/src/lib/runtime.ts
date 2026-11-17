import { Capacitor } from "@capacitor/core";
export const androidRuntime = Capacitor.getPlatform() === "android";
export const webDemoRuntime = false;
export const localRuntime = import.meta.env.DEV && !androidRuntime && ["localhost", "127.0.0.1"].includes(location.hostname);
export const browserRuntime = !androidRuntime;
export const tossRuntime = false;
