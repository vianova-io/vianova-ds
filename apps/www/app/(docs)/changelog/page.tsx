import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";

import { Badge } from "@/registry/vianova/ui/badge";
import { cn } from "@/registry/vianova/lib/utils";

export const metadata: Metadata = { title: "Changelog" };

type Entry = {
  sha: string;
  shortSha: string;
  date: string;
  author: string;
  type: string;
  scope: string | null;
  breaking: boolean;
  subject: string;
};

/**
 * Read at build time rather than imported.
 *
 * __changelog__.json is generated, and therefore gitignored, so a static
 * import makes `tsc --noEmit` fail on any checkout that has not built yet —
 * which is every fresh clone, and CI, where typecheck runs before build.
 * Reading it here keeps the type dependency out of the graph entirely.
 */
function readChangelog(): { entries: Entry[]; repo: string | null; partial?: boolean } {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "__changelog__.json"), "utf8"));
  } catch {
    return { entries: [], repo: null, partial: false };
  }
}

/** Conventional-commit types worth surfacing, with how they should read. */
const TYPES: Record<string, { label: string; className: string }> = {
  feat: { label: "Feature", className: "bg-success/15 text-success border-success/25" },
  fix: { label: "Fix", className: "bg-destructive/10 text-destructive border-destructive/25" },
  perf: { label: "Performance", className: "bg-info/15 text-info border-info/25" },
  refactor: { label: "Refactor", className: "" },
  docs: { label: "Docs", className: "" },
  style: { label: "Style", className: "" },
  test: { label: "Tests", className: "" },
  build: { label: "Build", className: "" },
  ci: { label: "CI", className: "" },
  chore: { label: "Chore", className: "" },
  other: { label: "Other", className: "" },
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Formats from the ISO string by hand rather than with toLocaleDateString.
 *
 * The runtime's default locale and timezone differ between the Node render and
 * the browser, and React reports the mismatch as a hydration error. Everything
 * here is read straight out of the ISO string, so both sides agree.
 */
function parts(iso: string) {
  return {
    day: `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`,
    time: iso.slice(11, 16),
    dayKey: iso.slice(0, 10),
  };
}

export default function ChangelogPage() {
  const { entries, repo, partial } = readChangelog();

  // git log is already newest-first; grouping preserves that order.
  const days: { key: string; label: string; entries: Entry[] }[] = [];
  for (const entry of entries) {
    const { dayKey, day } = parts(entry.date);
    const last = days.at(-1);
    if (last?.key === dayKey) last.entries.push(entry);
    else days.push({ key: dayKey, label: day, entries: [entry] });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Changelog</h1>
        <p className="text-muted-foreground max-w-2xl">
          Every change to the design system, newest first. Generated from git at
          build time rather than written by hand — a changelog someone has to
          remember to update is a changelog that stops being true.
        </p>
      </header>

      {/* Says so when the build could not see the whole history, rather than
          presenting a truncated log as complete. Vercel clones shallow and its
          container cannot always reach the remote to deepen it. */}
      {partial ? (
        <p className="border-border bg-muted/40 text-muted-foreground rounded-lg border p-3 text-sm">
          This build was made from a shallow clone, so only the most recent{" "}
          <span className="tabular-nums">{entries.length}</span> commits are
          shown.{" "}
          {repo ? (
            <a href={`${repo}/commits/main`} target="_blank" rel="noreferrer" className="underline">
              Full history on GitHub
            </a>
          ) : null}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No history available in this build.
        </p>
      ) : (
        <div className="space-y-10">
          {days.map((day) => (
            <section key={day.key} className="space-y-3">
              <div className="flex items-baseline gap-3">
                <h2 className="text-sm font-semibold">{day.label}</h2>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {day.entries.length} {day.entries.length === 1 ? "change" : "changes"}
                </span>
              </div>

              <ol className="border-border space-y-0 border-l pl-0">
                {day.entries.map((entry) => {
                  const type = TYPES[entry.type] ?? TYPES.other!;
                  const { time } = parts(entry.date);
                  return (
                    <li key={entry.sha} className="relative py-2.5 pl-5">
                      <span
                        aria-hidden
                        className="bg-border absolute top-4.5 -left-[3px] size-1.5 rounded-full"
                      />
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <time
                          dateTime={entry.date}
                          className="text-muted-foreground shrink-0 text-xs tabular-nums"
                        >
                          {time}
                        </time>
                        <Badge
                          variant="outline"
                          className={cn("shrink-0 font-normal", type.className)}
                        >
                          {type.label}
                        </Badge>
                        {entry.scope ? (
                          <code className="text-muted-foreground text-xs">{entry.scope}</code>
                        ) : null}
                        {entry.breaking ? (
                          <Badge variant="destructive" className="shrink-0">
                            Breaking
                          </Badge>
                        ) : null}
                        <span className="min-w-0 text-sm">{entry.subject}</span>
                        {repo ? (
                          <a
                            href={`${repo}/commit/${entry.sha}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground ml-auto shrink-0 font-mono text-xs"
                          >
                            {entry.shortSha}
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
