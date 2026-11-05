import { asset } from "@/lib/asset";

import { DIRECTIONS, FRAMES, type Direction } from "./frames";

/**
 * The contact sheet: every mockup frame, in a real 390x844 viewport, with what
 * each one is trying to show written under it.
 *
 * The frames are iframes rather than divs on purpose. `max-md:` and
 * `lg:hidden` resolve against the VIEWPORT, so a 390px-wide div on a desktop
 * page renders the desktop branch of every component in it -- a contact sheet
 * built that way would be a sheet of the wrong thing. An iframe has its own
 * viewport, so the frames inside these are genuinely at phone width, and they
 * stay interactive: direction A's tray really drags, B's bar really switches.
 *
 * TEMPORARY. Deleted with the rest of app/(bare)/mockups/.
 */

const PHONE = { width: 390, height: 844 };

function FrameCard({ id, note }: { id: string; note: string }) {
  return (
    <figure className="flex w-[390px] shrink-0 flex-col gap-2">
      <iframe
        src={asset(`/mockups/mobile-nav/${id}/`)}
        title={id}
        width={PHONE.width}
        height={PHONE.height}
        loading="lazy"
        className="border-border bg-background block rounded-[28px] border-4 shadow-lg"
      />
      <figcaption className="space-y-1">
        <p className="font-mono text-xs">{id}</p>
        <p className="text-muted-foreground text-sm">{note}</p>
      </figcaption>
    </figure>
  );
}

export default function MockupIndexPage() {
  const byDirection = (d: Direction) => FRAMES.filter((f) => f.direction === d);
  const diagnostics = FRAMES.filter((f) => f.direction === null);

  return (
    <main className="mx-auto max-w-none space-y-12 p-8">
      <header className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-semibold">Mobile navigation, three directions</h1>
        <p className="text-muted-foreground text-sm">
          Five blocks have arrived at five different answers to “how does a
          phone move around this”, and three of them have no answer at all.
          These frames propose one answer each, shown across the map,
          regulations, reports and the data hub, plus the basemap picker —
          which is the test of whether a direction has room for pictures.
        </p>
        <p className="text-muted-foreground text-sm">
          Everything here is built from the registry’s own components, at
          390×844. Nothing is implemented: these are for choosing.
        </p>
      </header>

      {(Object.keys(DIRECTIONS) as Direction[]).map((d) => (
        <section key={d} className="space-y-4">
          <div className="max-w-2xl space-y-1">
            <h2 className="text-lg font-medium">
              {d}. {DIRECTIONS[d].name}
            </h2>
            <p className="text-muted-foreground text-sm">{DIRECTIONS[d].gist}</p>
          </div>
          <div className="flex gap-8 overflow-x-auto pb-4">
            {byDirection(d).map((f) => (
              <FrameCard key={f.id} id={f.id} note={`${f.surface} — ${f.note}`} />
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-4">
        <div className="max-w-2xl space-y-1">
          <h2 className="text-lg font-medium">Not a proposal</h2>
          <p className="text-muted-foreground text-sm">
            One frame shown on its own, because it is the only way to look at
            the defect rather than read about it.
          </p>
        </div>
        <div className="flex gap-8 overflow-x-auto pb-4">
          {diagnostics.map((f) => (
            <FrameCard key={f.id} id={f.id} note={`${f.surface} — ${f.note}`} />
          ))}
        </div>
      </section>

      <section className="max-w-2xl space-y-2">
        <h2 className="text-lg font-medium">Clickable</h2>
        <p className="text-muted-foreground text-sm">
          Direction C is the one that has to be felt rather than looked at — a
          push either reads as going somewhere or it does not.{" "}
          <a
            className="text-primary underline underline-offset-4"
            href={asset("/mockups/mobile-nav/live/")}
          >
            Open the walkthrough
          </a>
          . Direction A’s frames are live too: the tray in any of them drags
          and snaps, because it is the shipped component.
        </p>
      </section>
    </main>
  );
}
