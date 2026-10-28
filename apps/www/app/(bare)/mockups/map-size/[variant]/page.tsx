import { notFound } from "next/navigation";

import { MapWorkspace } from "@/registry/vianova/blocks/map-workspace";

/**
 * The map workspace filling the viewport, with one of the two size controls.
 *
 * A route rather than two boxes on a page, for a different reason than the
 * top-bar harness has: the subject here is a control inside a panel, and that
 * panel is a docked column from lg up and a bottom tray below it. A 340px div
 * on a desktop page renders the docked branch and gives the row more room
 * than the tray ever will, which is the width the row is most likely to fail
 * at.
 *
 * TEMPORARY, with the `sizeControl` prop it exercises: deleted when one
 * control is chosen and becomes the only one.
 */
const VARIANTS = ["shipped", "panel"] as const;

export function generateStaticParams() {
  return VARIANTS.map((variant) => ({ variant }));
}

export default async function MapSizePage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  if (!VARIANTS.includes(variant as (typeof VARIANTS)[number])) notFound();

  // The block sizes itself off svh with a 760px ceiling at lg; the route is
  // what makes it a screen rather than a panel on a scrolling page. No border
  // and no radius here on purpose -- both belong to the docs page.
  return (
    <div className="h-dvh w-full [&>div]:h-full [&>div]:rounded-none [&>div]:border-0">
      <MapWorkspace sizeControl={variant as (typeof VARIANTS)[number]} />
    </div>
  );
}
