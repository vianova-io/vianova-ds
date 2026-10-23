import { notFound } from "next/navigation";

import { FRAME_IDS, FRAMES } from "../frames";
import { Frame } from "../frame";

/**
 * One mockup frame, chrome-less, filling the viewport.
 *
 * A route per frame rather than a box on a page, because the subject is
 * breakpoints: `max-md:` and `lg:hidden` resolve against the viewport, so a
 * grid of 390px divs would render every frame at desktop widths. Load this at
 * 390x844 and the frame gets a real phone viewport -- which is also what the
 * index page's iframes give it.
 *
 * TEMPORARY. Deleted with the rest of app/(bare)/mockups/ when a direction is
 * picked and implemented.
 */
export function generateStaticParams() {
  return FRAME_IDS.map((frame) => ({ frame }));
}

export default async function MockupFramePage({
  params,
}: {
  params: Promise<{ frame: string }>;
}) {
  const { frame } = await params;
  if (!FRAMES.some((f) => f.id === frame)) notFound();
  // Block is h-full; the route is what makes it a screen.
  return (
    <div className="h-dvh w-full">
      <Frame id={frame} />
    </div>
  );
}
