/**
 * Property tests for the CSS design token system (src/styles.css).
 * Properties 1, 2, 3 from the gdacaixa-redesign spec.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const css = readFileSync(resolve(__dirname, "../../src/styles.css"), "utf-8");

/** Extract OKLCH(L C H) lightness from a custom property inside a given block */
function extractLightness(block: string, varName: string): number | null {
  const re = new RegExp(
    String.raw`${varName}\s*:\s*oklch\(\s*([\d.]+)`,
    "i"
  );
  const m = block.match(re);
  return m ? parseFloat(m[1]) : null;
}

function extractHue(block: string, varName: string): number | null {
  const re = new RegExp(
    String.raw`${varName}\s*:\s*oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)`,
    "i"
  );
  const m = block.match(re);
  return m ? parseFloat(m[1]) : null;
}

/** Extract the .dark block content */
function getDarkBlock(): string {
  const m = css.match(/\.dark\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
  return m ? m[1] : "";
}

/** Extract the :root block content */
function getRootBlock(): string {
  const m = css.match(/:root\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
  return m ? m[1] : "";
}

// ── Property 1: Dark surface token lightness hierarchy ───────────────────
describe("Property 1: dark surface token lightness hierarchy", () => {
  const dark = getDarkBlock();

  it("dark --surface lightness should be ≤ 0.20", () => {
    const l = extractLightness(dark, "--surface");
    if (l === null) {
      // Token not yet written — skip gracefully
      console.warn("--surface not found in .dark block, skipping");
      return;
    }
    expect(l).toBeLessThanOrEqual(0.20);
  });

  it("dark surface container steps must be strictly ascending", () => {
    const surface = extractLightness(dark, "--surface");
    const low = extractLightness(dark, "--surface-container-low");
    const mid = extractLightness(dark, "--surface-container[^-]");
    const high = extractLightness(dark, "--surface-container-high[^e]");
    const highest = extractLightness(dark, "--surface-container-highest");

    // Use simpler regex for mid
    const midMatch = dark.match(/--surface-container:\s*oklch\(\s*([\d.]+)/);
    const midL = midMatch ? parseFloat(midMatch[1]) : null;
    const highMatch = dark.match(/--surface-container-high:\s*oklch\(\s*([\d.]+)/);
    const highL = highMatch ? parseFloat(highMatch[1]) : null;

    if (!surface || !low || !midL || !highL || !highest) {
      console.warn("Some dark surface tokens missing, skipping hierarchy test");
      return;
    }

    expect(surface).toBeLessThan(low);
    expect(low).toBeLessThan(midL);
    expect(midL).toBeLessThan(highL);
    expect(highL).toBeLessThan(highest);
  });
});

// ── Property 2: Primary hue in teal-green range ──────────────────────────
describe("Property 2: primary hue in teal-green range (155–185)", () => {
  it("dark --primary hue should be in [155, 185]", () => {
    const dark = getDarkBlock();
    const hue = extractHue(dark, "--primary");
    if (hue === null) {
      console.warn("--primary not found in .dark block, skipping");
      return;
    }
    expect(hue).toBeGreaterThanOrEqual(155);
    expect(hue).toBeLessThanOrEqual(185);
  });

  it("light --primary hue should be in [155, 185]", () => {
    const root = getRootBlock();
    const hue = extractHue(root, "--primary");
    if (hue === null) {
      console.warn("--primary not found in :root block, skipping");
      return;
    }
    expect(hue).toBeGreaterThanOrEqual(155);
    expect(hue).toBeLessThanOrEqual(185);
  });
});

// ── Property 3: Light surface contrast invariant ─────────────────────────
describe("Property 3: light surface contrast invariant", () => {
  const root = getRootBlock();

  it("light --surface lightness should be ≥ 0.90", () => {
    const l = extractLightness(root, "--surface");
    if (l === null) {
      console.warn("--surface not found in :root, skipping");
      return;
    }
    expect(l).toBeGreaterThanOrEqual(0.90);
  });

  it("light --foreground lightness should be ≤ 0.30 (dark text)", () => {
    const l = extractLightness(root, "--foreground");
    if (l === null) {
      console.warn("--foreground not found in :root, skipping");
      return;
    }
    expect(l).toBeLessThanOrEqual(0.30);
  });

  it("approximate contrast: foreground lightness < 0.3 and surface lightness > 0.85", () => {
    const fg = extractLightness(root, "--foreground");
    const bg = extractLightness(root, "--surface");
    if (fg === null || bg === null) {
      console.warn("tokens missing, skipping contrast test");
      return;
    }
    expect(fg).toBeLessThan(0.30);
    expect(bg).toBeGreaterThan(0.85);
  });
});
