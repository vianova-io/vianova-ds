/**
 * Generates two things from the files on disk, so neither is hand-maintained:
 *
 *   registry.json          the manifest `npx shadcn build` consumes
 *   __registry__/index.tsx a STATIC map of example name -> lazy component
 *
 * The map must be generated rather than built at runtime: Next cannot code-split
 * a dynamic `import()` whose specifier is a template literal, so a runtime
 * lookup silently ships every example in one chunk (or fails outright).
 *
 * Component metadata is DERIVED, not listed. With 60+ components a hand-written
 * table goes stale the moment anyone runs `shadcn add`, and its npm/registry
 * dependencies are exactly the thing that breaks a consumer's install if it
 * drifts -- so both are parsed from the source instead.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const REG = join(APP, "registry", "vianova");

const UI = join(REG, "ui");
const LIB = join(REG, "lib");
const HOOKS = join(REG, "hooks");
const EXAMPLES = join(REG, "examples");
const BLOCKS = join(REG, "blocks");
const PRODUCT = join(REG, "product");
const PATTERNS = join(REG, "patterns");

/** Only affects grouping on the index page; unlisted components fall through. */
const CATEGORY: Record<string, string> = {
  button: "Actions", "button-group": "Actions", toggle: "Actions",
  "toggle-group": "Actions", spinner: "Actions",

  input: "Forms", "input-group": "Forms", "input-otp": "Forms", textarea: "Forms",
  label: "Forms", checkbox: "Forms", "radio-group": "Forms", switch: "Forms",
  select: "Forms", "native-select": "Forms", combobox: "Forms", slider: "Forms",
  calendar: "Forms", field: "Forms", form: "Forms", questionnaire: "Forms",
  attachment: "Forms",

  dialog: "Overlays", "alert-dialog": "Overlays", sheet: "Overlays", drawer: "Overlays",
  popover: "Overlays", "hover-card": "Overlays", tooltip: "Overlays",
  "dropdown-menu": "Overlays", "context-menu": "Overlays", menubar: "Overlays",
  command: "Overlays", sonner: "Overlays", toast: "Overlays",

  accordion: "Disclosure", collapsible: "Disclosure", tabs: "Disclosure",

  table: "Data display", badge: "Data display", avatar: "Data display",
  chart: "Data display", progress: "Data display", skeleton: "Data display",
  empty: "Data display", item: "Data display", kbd: "Data display",
  marker: "Data display", alert: "Data display",

  card: "Layout", separator: "Layout", "aspect-ratio": "Layout",
  "scroll-area": "Layout", resizable: "Layout", sidebar: "Layout", direction: "Layout",

  breadcrumb: "Navigation", pagination: "Navigation", "navigation-menu": "Navigation",
  carousel: "Navigation",

  bubble: "AI", message: "AI", "message-scroller": "AI",
};

const titleCase = (name: string) =>
  name
    .split("-")
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");

/**
 * Parses every bare-module import so `dependencies` reflects what the file
 * actually needs. Scoped packages keep two segments; deep paths are trimmed to
 * the package root.
 */
function externalDeps(source: string): string[] {
  const found = new Set<string>();
  for (const m of source.matchAll(/from\s+["']([^"']+)["']/g)) {
    const spec = m[1]!;
    if (spec.startsWith(".") || spec.startsWith("@/")) continue;
    if (spec === "react" || spec === "react-dom" || spec.startsWith("react/")) continue;
    if (spec === "next" || spec.startsWith("next/")) continue;
    const parts = spec.split("/");
    found.add(spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!);
  }
  return [...found].sort();
}

/** Internal `@/registry/vianova/...` imports become namespaced registry deps. */
function registryDeps(source: string): string[] {
  const found = new Set<string>();
  for (const m of source.matchAll(/from\s+["']@\/registry\/vianova\/(ui|product|lib|hooks)\/([^"']+)["']/g)) {
    const kind = m[1]!;
    const file = basename(m[2]!);
    found.add(kind === "lib" && file === "utils" ? "@vianova/utils" : `@vianova/${file}`);
  }
  return [...found].sort();
}

// --- Discover ----------------------------------------------------------------

const uiNames = readdirSync(UI)
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => basename(f, ".tsx"))
  .sort();

if (!uiNames.length) throw new Error(`No components found in ${UI}`);

/**
 * Vianova-specific components live in product/, not ui/. Keeping them apart
 * matters: `shadcn add` overwrites files in ui/ when a component is re-pulled
 * from upstream, which would silently destroy anything of ours parked there.
 */
const productNames = existsSync(PRODUCT)
  ? readdirSync(PRODUCT).filter((f) => f.endsWith(".tsx")).map((f) => basename(f, ".tsx")).sort()
  : [];

/**
 * Composed patterns live in patterns/: several primitives wired into one
 * opinionated arrangement (app-shell, date-range-picker, tag-input). Kept out
 * of ui/ for the same overwrite reason as product/, and out of product/
 * because they carry no Vianova-specific domain knowledge -- any shadcn app
 * could install them.
 */
const patternNames = existsSync(PATTERNS)
  ? readdirSync(PATTERNS).filter((f) => f.endsWith(".tsx")).map((f) => basename(f, ".tsx")).sort()
  : [];

const allNames = [...uiNames, ...productNames, ...patternNames];
const dirOf = (name: string) =>
  productNames.includes(name) ? "product" : patternNames.includes(name) ? "patterns" : "ui";

/** Every lib/*.ts is installable on its own; components declare what they use. */
const libNames = readdirSync(LIB)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => basename(f, ".ts"))
  .sort();

const LIB_DESCRIPTION: Record<string, string> = {
  utils: "cn() class-name helper.",
};

const hookNames = existsSync(HOOKS)
  ? readdirSync(HOOKS).filter((f) => f.endsWith(".ts")).map((f) => basename(f, ".ts")).sort()
  : [];

const exampleFiles = existsSync(EXAMPLES)
  ? readdirSync(EXAMPLES).filter((f) => f.endsWith(".tsx")).map((f) => basename(f, ".tsx")).sort()
  : [];

// Longest matching component name wins, so `button-group-x` is not attributed
// to `button`.
const byComponent = new Map<string, string[]>();
for (const ex of exampleFiles) {
  const owner = allNames
    .filter((c) => ex === c || ex.startsWith(`${c}-`))
    .sort((a, b) => b.length - a.length)[0];
  if (!owner) {
    throw new Error(
      `Example "${ex}.tsx" matches no component. Name it "<component>-<variant>.tsx".`,
    );
  }
  byComponent.set(owner, [...(byComponent.get(owner) ?? []), ex]);
}

/**
 * Blocks are whole compositions rather than single primitives, so they are
 * registry:block and get their own index and route. Their dependencies are
 * parsed exactly like a component's -- a block pulls in far more of them,
 * which is precisely why they must not be hand-listed.
 */
const blockNames = existsSync(BLOCKS)
  ? readdirSync(BLOCKS).filter((f) => f.endsWith(".tsx")).map((f) => basename(f, ".tsx")).sort()
  : [];

const blocks = blockNames.map((name) => {
  const source = readFileSync(join(BLOCKS, `${name}.tsx`), "utf8");
  return {
    name,
    title: titleCase(name),
    description: `${titleCase(name)} layout, composed from Vianova components.`,
    dependencies: externalDeps(source),
    registryDependencies: registryDeps(source),
  };
});

const components = allNames.map((name) => {
  const dir = dirOf(name);
  const source = readFileSync(join(REG, dir, `${name}.tsx`), "utf8");
  return {
    name,
    dir,
    title: titleCase(name),
    description:
      dir === "product"
        ? `${titleCase(name)} — a Vianova product component.`
        : dir === "patterns"
          ? `${titleCase(name)} — primitives composed into one pattern.`
          : `${titleCase(name)} component, themed by @vianova/tokens.`,
    category:
      dir === "product" ? "Product" : dir === "patterns" ? "Patterns" : (CATEGORY[name] ?? "Components"),
    status: "stable" as const,
    dependencies: externalDeps(source),
    registryDependencies: registryDeps(source),
    examples: byComponent.get(name) ?? [],
  };
});

// --- registry.json -----------------------------------------------------------

const items = [
  ...libNames.map((l) => {
    const source = readFileSync(join(LIB, `${l}.ts`), "utf8");
    return {
      name: l,
      type: "registry:lib",
      title: titleCase(l),
      description: LIB_DESCRIPTION[l] ?? `${titleCase(l)} helpers.`,
      files: [{ path: `registry/vianova/lib/${l}.ts`, type: "registry:lib" }],
      ...(externalDeps(source).length ? { dependencies: externalDeps(source) } : {}),
      ...(registryDeps(source).length ? { registryDependencies: registryDeps(source) } : {}),
    };
  }),
  ...hookNames.map((h) => ({
    name: h,
    type: "registry:hook",
    title: titleCase(h),
    description: `${titleCase(h)} hook.`,
    files: [{ path: `registry/vianova/hooks/${h}.ts`, type: "registry:hook" }],
    dependencies: externalDeps(readFileSync(join(HOOKS, `${h}.ts`), "utf8")),
  })),
  ...blocks.map((b) => ({
    name: b.name,
    type: "registry:block",
    title: b.title,
    description: b.description,
    ...(b.dependencies.length ? { dependencies: b.dependencies } : {}),
    registryDependencies: [...new Set(["@vianova/utils", ...b.registryDependencies])].sort(),
    files: [{ path: `registry/vianova/blocks/${b.name}.tsx`, type: "registry:block" }],
    meta: { status: "stable" },
  })),
  ...components.map((c) => ({
    name: c.name,
    type: "registry:ui",
    title: c.title,
    description: c.description,
    categories: [c.category],
    ...(c.dependencies.length ? { dependencies: c.dependencies } : {}),
    // cn() is imported by nearly every component. Declaring it is load-bearing:
    // shadcn rewrites the alias to the consumer's @/lib/utils either way, so an
    // undeclared dep produces an install that looks fine and then fails to
    // compile on a file that was never written.
    registryDependencies: [...new Set(["@vianova/utils", ...c.registryDependencies])].sort(),
    files: [{ path: `registry/vianova/${c.dir}/${c.name}.tsx`, type: "registry:ui" }],
    meta: { status: c.status },
  })),
];

const theme = JSON.parse(
  readFileSync(join(APP, "..", "..", "packages", "tokens", "dist", "registry-theme.json"), "utf8"),
);

writeFileSync(
  join(APP, "registry.json"),
  JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema/registry.json",
      name: "vianova",
      homepage: "https://vianova-io.github.io/vianova-ds",
      items: [{ ...theme, files: [] }, ...items],
    },
    null,
    2,
  ) + "\n",
);

// --- __registry__/index.tsx ---------------------------------------------------

const outDir = join(APP, "__registry__");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const index = `// GENERATED by scripts/build-registry.ts -- do not edit by hand.
import * as React from "react";

export type RegistryExample = {
  name: string;
  component: React.LazyExoticComponent<React.ComponentType>;
  file: string;
};

export type RegistryComponent = {
  name: string;
  title: string;
  description: string;
  category: string;
  status: "stable" | "beta" | "deprecated";
  source: string;
  examples: RegistryExample[];
};

export const Index: Record<string, RegistryComponent> = {
${components
  .map(
    (c) => `  "${c.name}": {
    name: "${c.name}",
    title: ${JSON.stringify(c.title)},
    description: ${JSON.stringify(c.description)},
    category: ${JSON.stringify(c.category)},
    status: "${c.status}",
    source: "registry/vianova/${c.dir}/${c.name}.tsx",
    examples: [${
      c.examples.length
        ? "\n" +
          c.examples
            .map(
              (e) => `      {
        name: "${e}",
        component: React.lazy(() => import("@/registry/vianova/examples/${e}")),
        file: "registry/vianova/examples/${e}.tsx",
      },`,
            )
            .join("\n") +
          "\n    "
        : ""
    }],
  },`,
  )
  .join("\n")}
};

export type RegistryBlock = {
  name: string;
  title: string;
  description: string;
  source: string;
  component: React.LazyExoticComponent<React.ComponentType>;
};

export const Blocks: Record<string, RegistryBlock> = {
${blocks
  .map(
    (b) => `  "${b.name}": {
    name: "${b.name}",
    title: ${JSON.stringify(b.title)},
    description: ${JSON.stringify(b.description)},
    source: "registry/vianova/blocks/${b.name}.tsx",
    component: React.lazy(() => import("@/registry/vianova/blocks/${b.name}")),
  },`,
  )
  .join("\n")}
};

export const categories = ${JSON.stringify([...new Set(components.map((c) => c.category))].sort())};
`;

writeFileSync(join(outDir, "index.tsx"), index);

const withExamples = components.filter((c) => c.examples.length).length;
console.log(
  `registry: ${components.length} components (${productNames.length} product, ${patternNames.length} patterns, ${withExamples} with examples), ` +
    `${blocks.length} blocks, ${hookNames.length} hooks, ${exampleFiles.length} examples`,
);
