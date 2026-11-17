
import { androidRuntime } from "./runtime";
/** Set all four insets before React paints, then follow host/orientation/viewport changes. */
export function installSafeArea() {
  const root = document.documentElement;
  root.dataset.aimiHost = androidRuntime ? "android" : "browser";
  const viewport = () => {
    const visual = window.visualViewport;
    root.style.setProperty(
      "--visual-viewport-height",
      (visual?.height ?? window.innerHeight) + "px",
    );
    root.style.setProperty(
      "--visual-viewport-top",
      (visual?.offsetTop ?? 0) + "px",
    );
    const editing = document.activeElement?.matches(
      "input,textarea,[contenteditable=true]",
    );
    root.dataset.keyboard =
      editing &&
      Math.max(root.clientHeight, window.innerHeight) -
        (visual?.height ?? window.innerHeight) >
        120
        ? "open"
        : "closed";
  };
  viewport();
  const refresh = () => {
      viewport();
  };
  window.addEventListener("resize", refresh);
  window.addEventListener("orientationchange", refresh);
  window.addEventListener("pageshow", refresh);
  document.addEventListener("focusin", viewport);
  document.addEventListener("focusout", viewport);
  window.visualViewport?.addEventListener("resize", viewport);
  window.visualViewport?.addEventListener("scroll", viewport);
  return () => {
    window.removeEventListener("resize", refresh);
    window.removeEventListener("orientationchange", refresh);
    window.removeEventListener("pageshow", refresh);
    document.removeEventListener("focusin", viewport);
    document.removeEventListener("focusout", viewport);
    window.visualViewport?.removeEventListener("resize", viewport);
    window.visualViewport?.removeEventListener("scroll", viewport);
  };
}
