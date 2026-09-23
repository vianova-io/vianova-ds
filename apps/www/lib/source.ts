import { readFileSync } from "node:fs";
import { join } from "node:path";

import { codeToHtml } from "shiki";

const APP_ROOT = process.cwd();

/**
 * Rewrites the registry's internal import alias to the path a consumer will
 * actually have after `shadcn add`.
 *
 * Without this every published snippet is non-copy-pasteable: the docs show
 * `@/registry/vianova/ui/button`, but the installed file lives at
 * `@/components/ui/button`. shadcn's CLI performs the same rewrite on install,
 * so this keeps the displayed source honest about what you get.
 */
export function rewriteAliases(source: string): string {
  return source
    .replace(/@\/registry\/vianova\/lib\/utils/g, "@/lib/utils")
    .replace(/@\/registry\/vianova\/hooks\//g, "@/hooks/")
    .replace(/@\/registry\/vianova\/(?:ui|product)\//g, "@/components/ui/");
}

export function readRegistryFile(relativePath: string): string {
  return readFileSync(join(APP_ROOT, relativePath), "utf8").trimEnd();
}

/**
 * Highlights with BOTH themes at once and no default colour, so switching
 * light/dark is a CSS variable flip rather than a re-render.
 */
export async function highlight(code: string, lang = "tsx"): Promise<string> {
  return codeToHtml(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark-default" },
    defaultColor: false,
  });
}
