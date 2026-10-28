"use client";

import * as React from "react";

import { SizePanel } from "@/registry/vianova/product/size-panel";

const FIELDS = [
  { name: "daily_traffic", label: "Daily traffic" },
  { name: "hgv_share", label: "HGV share" },
  { name: "avg_speed", label: "Average speed" },
];

/**
 * One size for the whole layer: a radius slider and a width slider.
 *
 * The fix for the complaint this panel was built for -- traffic counts drawn
 * as dots too small to see, with nothing in the stepper to make them bigger.
 * Size is its own panel beside Colorize rather than a section inside it: the
 * merged version reached 819px and carried two rows labelled "Mode" and two
 * labelled "Classification".
 */
export default function SizePanelDefault() {
  return <SizePanel geometry="both" fields={FIELDS} />;
}
