import { notFound } from "next/navigation";

import { MapWorkspace } from "@/registry/vianova/blocks/map-workspace";

/**
 * The map workspace filling the viewport, in one of the two top-bar
 * arrangements.
 *
 * A route per arrangement rather than two boxes on a page, because the subject
 * is breakpoints: the bar makes three different arrangements of itself at
 * phone, md and xl, and `md:hidden` / `lg:inline-flex` resolve against the
 * VIEWPORT. A 390px-wide div on a desktop page renders the desktop branch of
 * every control in it, so a side-by-side built that way would compare the
 * wrong thing. Loaded at 390x844 -- directly, or in the harness's iframe --
 * this gets a real phone viewport, and stays clickable while it is there.
 *
 * TEMPORARY, with the `topBar` prop it exercises: deleted when one arrangement
 * is chosen and becomes the only one.
 */
const VARIANTS = ["shipped", "edges"] as const;

export function generateStaticParams() {
  return VARIANTS.map((variant) => ({ variant }));
}

export default async function MapTopBarPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  if (!VARIANTS.includes(variant as (typeof VARIANTS)[number])) notFound();

  // The block sizes itself off svh with a 760px ceiling at lg; the route is
  // what makes it a screen rather than a panel on a scrolling page. No border
  // and no radius here on purpose -- both belong to the docs page, and at
  // 390px they eat 8px of the bar's budget.
  return (
    <div className="h-dvh w-full [&>div]:h-full [&>div]:rounded-none [&>div]:border-0">
      <MapWorkspace topBar={variant as (typeof VARIANTS)[number]} />
    </div>
  );
}
