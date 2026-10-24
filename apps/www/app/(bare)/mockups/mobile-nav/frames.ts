/**
 * The mockup set for the mobile-navigation proposal.
 *
 * TEMPORARY. This whole directory is a deliverable to look at and argue with,
 * not a thing to ship: it is deleted in the commit that implements whichever
 * direction wins. It lives under `app/(bare)/` rather than in
 * `registry/vianova/examples/`, which is directory-scanned by
 * `scripts/build-registry.ts` -- anything dropped in there auto-enrols into
 * /preview, the axe crawl and the visual suite, which would mean two committed
 * baselines per screen for something disposable.
 *
 * Each frame is its own ROUTE rather than a box on one page, because the whole
 * subject is breakpoints: `max-md:`, `lg:hidden` and friends resolve against
 * the viewport, not against a 390px-wide div, so a contact sheet of divs would
 * render every frame at desktop widths and prove nothing. The index page
 * embeds these routes in 390x844 iframes, which DO give their contents a real
 * viewport, and the screenshot script loads them directly at 390x844.
 */

export type Direction = "A" | "B" | "C";

export type Frame = {
  id: string;
  /** Null for the diagnostic frame, which belongs to no direction. */
  direction: Direction | null;
  surface: string;
  /** What this frame is for -- printed under it on the index. */
  note: string;
};

export const DIRECTIONS: Record<Direction, { name: string; gist: string }> = {
  A: {
    name: "Tray everywhere",
    gist:
      "Generalise the map's bottom tray: every block's secondary region becomes a tray over its primary one, dismissible, at three heights.",
  },
  B: {
    name: "Bottom segment bar",
    gist:
      "A bar pinned to the bottom of the block names its regions and switches between full-screen views of them. Closest to the phone conventions people arrive with; costs 56px forever.",
  },
  C: {
    name: "List to detail, pushed",
    gist:
      "What datahub, feeds and reports already do, made consistent: one back affordance at 44px, one transition, one place the title goes -- and the map and regulations adopt it too.",
  },
};

export const FRAMES: Frame[] = [
  {
    id: "a-map",
    direction: "A",
    surface: "Map workspace",
    note: "The shipped mechanism, unchanged: tray at half, two lit disclosures in the bar, map visible behind.",
  },
  {
    id: "a-regulations",
    direction: "A",
    surface: "Regulations",
    note: "The map becomes the primary region and the rule settings move into the tray. Replaces the SegmentedControl labelled 'Show'.",
  },
  {
    id: "a-reports",
    direction: "A",
    surface: "Reports",
    note: "Widgets scroll as the primary; filters become the tray, shown at peek -- a header and the top of a row, which is what peek is for. Widget heights are re-derived for 390px rather than kept at desktop row pixels.",
  },
  {
    id: "a-datahub",
    direction: "A",
    surface: "Data hub",
    note: "The awkward case: the detail is not secondary to the list, so the tray has to open to full and the list behind it is unreachable without closing.",
  },
  {
    id: "a-basemap",
    direction: "A",
    surface: "Basemap picker",
    note: "Thumbnails in the tray, shown at half. Measured: peek is 126px of an 844px block and the row needs about 172, so at the smallest snap the captions fall below the fold -- an argument for a fourth snap, or for the picker being a pushed level.",
  },
  {
    id: "b-map",
    direction: "B",
    surface: "Map workspace",
    note: "Map, Layers, Charts as three segments. The map region is 56px shorter than it is today, permanently.",
  },
  {
    id: "b-regulations",
    direction: "B",
    surface: "Regulations",
    note: "Map, Rules, Settings. The bar makes the third region discoverable, which the 'Show' control's two options never did.",
  },
  {
    id: "b-reports",
    direction: "B",
    surface: "Reports",
    note: "Report, Filters, Export. The filter sheet stops being a popover substitute and becomes a region.",
  },
  {
    id: "b-datahub",
    direction: "B",
    surface: "Data hub",
    note: "Datasets, Columns, Preview. Fits, but the bar names regions of one dataset while the list is a level above -- two navigations in one screen.",
  },
  {
    id: "b-basemap",
    direction: "B",
    surface: "Basemap picker",
    note: "Thumbnails in a full-screen region reached from the bar. The most room for pictures of the three directions, and the furthest from the map you are changing.",
  },
  {
    id: "c-map",
    direction: "C",
    surface: "Map workspace",
    note: "Map is the root; Layers is pushed over it with a back chevron. The map is completely covered while you work on a layer.",
  },
  {
    id: "c-regulations",
    direction: "C",
    surface: "Regulations",
    note: "Rules list as root, one rule pushed. This is PanelStepper's docked phone behaviour, which already ships and is already tested.",
  },
  {
    id: "c-reports",
    direction: "C",
    surface: "Reports",
    note: "Report as root, a widget pushed full-screen. A 4-row chart gets the width it needs instead of a 540px box in a 390px column.",
  },
  {
    id: "c-datahub",
    direction: "C",
    surface: "Data hub",
    note: "What the block does today, with the back affordance at 44px instead of 32 and the title where the other four put it.",
  },
  {
    id: "c-basemap",
    direction: "C",
    surface: "Basemap picker",
    note: "A pushed level. Room for the pictures, but choosing a basemap without seeing the map is the one choice where that matters most.",
  },
  {
    id: "defect-cardfilters",
    direction: null,
    surface: "Reports, CardFilters",
    note: "Not a proposal. The useIsMobile defect, shown rather than described: at 390px the exported HTML ships the desktop Popover trigger and swaps a frame later, and between 768 and 1023 the block is stacked but gets the Popover anyway.",
  },
];

export const FRAME_IDS = FRAMES.map((f) => f.id);
