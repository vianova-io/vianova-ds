import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CATEGORY_PALETTE,
  adviseLogo,
  badgeColor,
  contrastBetween,
  kindFromEdge,
  SOLID_EDGE_SHARE,
  luminance,
  parseHex,
  readStyleSet,
  visibleBounds,
  resolveStyles,
  writeStyleSet,
  type CategoryStyleSet,
} from "../registry/vianova/lib/category-style.ts";

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

test("parses #rgb and #rrggbb, and nothing else", () => {
  assert.deepEqual(parseHex("#0f766e"), [15, 118, 110]);
  assert.deepEqual(parseHex("#fff"), [255, 255, 255]);
  assert.equal(parseHex("var(--chart-1)"), null);
  assert.equal(parseHex("red"), null);
});

test("contrast: white on black is 21, a colour on itself is 1", () => {
  const white = luminance([255, 255, 255]);
  const black = luminance([0, 0, 0]);
  assert.equal(Math.round(contrastBetween(white, black)), 21);
  assert.equal(contrastBetween(0.3, 0.3), 1);
});

test("an unstyled value gets the palette in value order, wrapping", () => {
  const values = Array.from({ length: CATEGORY_PALETTE.length + 1 }, (_, i) => `v${i}`);
  const styles = resolveStyles(values);
  assert.equal(styles.v0!.color, CATEGORY_PALETTE[0]);
  assert.equal(styles.v1!.color, CATEGORY_PALETTE[1]);
  assert.equal(styles[`v${CATEGORY_PALETTE.length}`]!.color, CATEGORY_PALETTE[0]);
});

test("a stored style wins over the palette, the rest still fall back", () => {
  const styles = resolveStyles(["a", "b"], {
    logoZoom: 14,
    values: { b: { color: "#123456" } },
  });
  assert.equal(styles.a!.color, CATEGORY_PALETTE[0]);
  assert.equal(styles.b!.color, "#123456");
});

test("styles survive a write and a read, per dataset and column", () => {
  const store = memory();
  const set: CategoryStyleSet = { logoZoom: 12, values: { Lime: { color: "#0f766e" } } };
  assert.equal(writeStyleSet("lisbon", "provider_name", set, store), true);
  assert.deepEqual(readStyleSet("lisbon", "provider_name", store), set);
  assert.equal(readStyleSet("lisbon", "vehicle_type", store), undefined);
  assert.equal(readStyleSet("other", "provider_name", store), undefined);
});

test("writing one column does not disturb another", () => {
  const store = memory();
  writeStyleSet("d", "a", { logoZoom: 10, values: {} }, store);
  writeStyleSet("d", "b", { logoZoom: 16, values: {} }, store);
  assert.equal(readStyleSet("d", "a", store)!.logoZoom, 10);
  assert.equal(readStyleSet("d", "b", store)!.logoZoom, 16);
});

test("corrupt or full storage reads as empty and writes report failure", () => {
  const corrupt = { getItem: () => "{not json", setItem: () => {} };
  assert.equal(readStyleSet("d", "a", corrupt), undefined);
  const full = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.equal(writeStyleSet("d", "a", { logoZoom: 14, values: {} }, full), false);
  assert.equal(writeStyleSet("d", "a", { logoZoom: 14, values: {} }, null), false);
});

test("no logo, no advice", () => {
  assert.deepEqual(adviseLogo({ color: "#0f766e" }), []);
});

test("a solid logo is explained and never warned about", () => {
  const advice = adviseLogo({ color: "#0f766e", logo: "x", logoKind: "solid", logoLuminance: 0.1 });
  assert.equal(advice.length, 1);
  assert.equal(advice[0]!.kind, "info");
});

test("a transparent logo that stands out only gets the explanation", () => {
  const advice = adviseLogo({ color: "#0f766e", logo: "x", logoKind: "transparent", logoLuminance: 0.95 });
  assert.deepEqual(advice.map((a) => a.kind), ["info"]);
});

test("a dark transparent logo on a dark colour is warned, and offered white", () => {
  const advice = adviseLogo({ color: "#111827", logo: "x", logoKind: "transparent", logoLuminance: 0.02 });
  const warning = advice.find((a) => a.kind === "warning");
  assert.ok(warning, "expected a warning");
  assert.equal(warning!.suggestion, "#ffffff");
  assert.match(warning!.message, /too close in tone/);
});

test("a light transparent logo on a light colour is offered the dark badge", () => {
  const advice = adviseLogo({ color: "#fef3c7", logo: "x", logoKind: "transparent", logoLuminance: 0.9 });
  const warning = advice.find((a) => a.kind === "warning");
  assert.ok(warning);
  assert.equal(warning!.suggestion, "#111827");
  assert.match(warning!.message, /too close in tone/);
});

test("a colour that is not a hex cannot be compared, so it is not warned about", () => {
  const advice = adviseLogo({ color: "var(--chart-1)", logo: "x", logoKind: "transparent", logoLuminance: 0.02 });
  assert.deepEqual(advice.map((a) => a.kind), ["info"]);
});

test("a logo whose edge is filled has its own background; one with an empty edge floats", () => {
  assert.equal(kindFromEdge(1), "solid");
  assert.equal(kindFromEdge(SOLID_EDGE_SHARE), "solid");
  assert.equal(kindFromEdge(0), "transparent");
});

test("a few see-through seams on the edge do not make a logo transparent", () => {
  // Gira: a circle on white corners, with anti-aliased gaps where they meet.
  assert.equal(kindFromEdge(0.96), "solid");
});

test("a mark that only touches its box at a few points is transparent", () => {
  // Lime: a circle in a square, touching each side once.
  assert.equal(kindFromEdge(0.05), "transparent");
});

test("the badge is the dot's colour unless it has its own", () => {
  assert.equal(badgeColor({ color: "#0f766e" }), "#0f766e");
  assert.equal(badgeColor({ color: "#0f766e", badge: "#ffffff" }), "#ffffff");
});

test("advice looks at the badge behind the logo, not the dot", () => {
  // A green logo is lost on a green dot colour, but sits fine on a white badge.
  const lost = adviseLogo({ color: "#0f766e", logo: "x", logoKind: "transparent", logoLuminance: 0.15 });
  assert.ok(lost.some((a) => a.kind === "warning"), "same-tone dot colour as badge should warn");

  const fixed = adviseLogo({ color: "#0f766e", badge: "#ffffff", logo: "x", logoKind: "transparent", logoLuminance: 0.15 });
  assert.deepEqual(fixed.map((a) => a.kind), ["info"]);
});

test("a bad badge is warned about even when the dot colour would have been fine", () => {
  const advice = adviseLogo({ color: "#ffffff", badge: "#0f766e", logo: "x", logoKind: "transparent", logoLuminance: 0.15 });
  assert.ok(advice.some((a) => a.kind === "warning"));
});

/** An RGBA buffer, all empty, with the given pixels filled in. */
const picture = (width: number, height: number, filled: [number, number][]) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y] of filled) data[(y * width + x) * 4 + 3] = 255;
  return data;
};

test("the visible bounds hug the mark and ignore empty margin", () => {
  const data = picture(10, 8, [[3, 2], [6, 5], [4, 3]]);
  assert.deepEqual(visibleBounds(data, 10, 8), { x: 3, y: 2, width: 4, height: 4 });
});

test("a picture with nothing in it has no bounds", () => {
  assert.equal(visibleBounds(picture(6, 6, []), 6, 6), null);
});

test("a faint haze below the margin alpha is margin, not mark", () => {
  const data = picture(6, 6, [[2, 2]]);
  data[(0 * 6 + 0) * 4 + 3] = 8; // a stray near-invisible pixel in the corner
  assert.deepEqual(visibleBounds(data, 6, 6), { x: 2, y: 2, width: 1, height: 1 });
});

test("a mark that fills the picture is its own bounds", () => {
  const all: [number, number][] = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) all.push([x, y]);
  assert.deepEqual(visibleBounds(picture(5, 4, all), 5, 4), { x: 0, y: 0, width: 5, height: 4 });
});
