/**
 * Turns git history into the data behind /changelog.
 *
 * Generated at build time rather than committed: a checked-in changelog is
 * stale the moment the next commit lands, and hand-written ones stop being
 * written by month three. Git already records every change with an author and
 * a timestamp, so it is the only source that cannot drift.
 *
 * Output is gitignored. If git is unavailable the page renders empty rather
 * than failing the build — a docs page is not worth breaking a deploy over.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(APP, "__changelog__.json");

const UNIT = "";
const RECORD = "";

export type ChangelogEntry = {
  sha: string;
  shortSha: string;
  /** ISO 8601, author date. */
  date: string;
  author: string;
  /** Conventional-commit type, or "other" when the subject has no prefix. */
  type: string;
  scope: string | null;
  breaking: boolean;
  subject: string;
  body: string;
};

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: APP, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
}

/**
 * Returns true when history is still incomplete after trying to deepen it.
 *
 * Vercel clones shallow and its build container cannot always reach the remote
 * afterwards, so --unshallow fails. The first version of this swallowed that
 * and rendered ten commits as though they were the whole project history — a
 * changelog that is quietly wrong is worse than one that is obviously partial,
 * so the result is reported and the page says so.
 */
function deepenHistory(): boolean {
  const isShallow = () => {
    try {
      return git(["rev-parse", "--is-shallow-repository"]).trim() === "true";
    } catch {
      return false;
    }
  };

  if (!isShallow()) return false;

  for (const args of [
    ["fetch", "--unshallow", "--quiet"],
    ["fetch", "--depth=2000", "--quiet"],
  ]) {
    try {
      git(args);
      if (!isShallow()) return false;
    } catch {
      // Try the next strategy; the caller reports what is left.
    }
  }
  return isShallow();
}

const CONVENTIONAL = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;

function parse(raw: string): ChangelogEntry | null {
  const [sha, date, author, subject, body] = raw.split(UNIT);
  if (!sha || !date || !subject) return null;

  const match = CONVENTIONAL.exec(subject.trim());
  return {
    sha,
    shortSha: sha.slice(0, 7),
    date,
    author: author ?? "",
    type: match ? match[1]!.toLowerCase() : "other",
    scope: match?.[2] || null,
    breaking: Boolean(match?.[3]) || (body ?? "").includes("BREAKING CHANGE"),
    subject: match ? match[4]!.trim() : subject.trim(),
    body: (body ?? "").trim(),
  };
}

function repoUrl(): string | null {
  const { VERCEL_GIT_REPO_OWNER: owner, VERCEL_GIT_REPO_SLUG: slug } = process.env;
  if (owner && slug) return `https://github.com/${owner}/${slug}`;
  try {
    const remote = git(["remote", "get-url", "origin"]).trim();
    const m = /github\.com[:/](.+?)(?:\.git)?$/.exec(remote);
    return m ? `https://github.com/${m[1]}` : null;
  } catch {
    return null;
  }
}

function main() {
  let entries: ChangelogEntry[] = [];
  let repo: string | null = null;
  let partial = false;

  try {
    partial = deepenHistory();
    repo = repoUrl();
    // %aI is strict ISO 8601, which parses identically everywhere. git log is
    // already newest-first, so no sort is needed.
    const log = git([
      "log",
      `--pretty=format:%H${UNIT}%aI${UNIT}%an${UNIT}%s${UNIT}%b${RECORD}`,
      "--no-merges",
    ]);
    entries = log
      .split(RECORD)
      .map((r) => r.trim())
      .filter(Boolean)
      .map(parse)
      .filter((e): e is ChangelogEntry => e !== null);
  } catch (error) {
    console.warn(
      `changelog: no git history available (${(error as Error).message.split("\n")[0]}); writing an empty log.`,
    );
  }

  writeFileSync(OUT, JSON.stringify({ repo, entries, partial }, null, 2));
  console.log(
    `changelog: ${entries.length} commits${repo ? ` from ${repo}` : ""}` +
      (partial ? " (PARTIAL -- shallow clone could not be deepened)" : ""),
  );
}

main();
