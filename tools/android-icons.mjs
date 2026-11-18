// Package the existing AIMI artwork for Android launcher densities.
// Requires ImageMagick 7. The source artwork is not modified.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const source = "apps/miniapp/public/content/brand/aimi-logo-dark-transparent.png";
const resources = "android/app/src/main/res";
const cream = "#F3F0EB";
const scratch = mkdtempSync(join(tmpdir(), "aimi-icons-"));
const mark = join(scratch, "mark.png");
const magick = (...args) => execFileSync("magick", args);

try {
  // Optical artwork bounds, excluding transparent padding around the source.
  magick(source, "-crop", "1364x629+296+94", "+repage", mark);
  for (const [density, size, adaptiveSize] of [
    ["mdpi", 48, 108],
    ["hdpi", 72, 162],
    ["xhdpi", 96, 216],
    ["xxhdpi", 144, 324],
    ["xxxhdpi", 192, 432],
  ]) {
    const output = join(resources, `mipmap-${density}`);
    for (const round of [false, true]) {
      const shape = round
        ? `circle ${size / 2},${size / 2} ${size / 2},0`
        : `roundrectangle 0,0 ${size - 1},${size - 1} ${size * 0.17},${size * 0.17}`;
      magick(
        "-size", `${size}x${size}`, "xc:none", "-fill", cream, "-draw", shape,
        "(", mark, "-resize", `${Math.round(size * 0.71)}x`, ")",
        "-gravity", "center", "-composite", "-depth", "8",
        join(output, round ? "ic_launcher_round.png" : "ic_launcher.png"),
      );
    }
    // Adaptive icons show a 72dp viewport within the 108dp layer.
    // Keep the full wordmark inside its guaranteed safe zone for every mask.
    magick(
      "-size", `${adaptiveSize}x${adaptiveSize}`, "xc:none",
      "(", mark, "-resize", `${Math.round(adaptiveSize * 0.474)}x`, ")",
      "-gravity", "center", "-composite", "-depth", "8",
      join(output, "ic_launcher_foreground.png"),
    );
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
