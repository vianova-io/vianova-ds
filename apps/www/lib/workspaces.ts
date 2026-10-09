import type { Blocks } from "@/__registry__";

/**
 * The order workspaces are listed in, which is not the order they are
 * generated in.
 *
 * `registry.json` sorts blocks by filename, so alphabetical order puts Data
 * Hub first. That is an artefact of how the manifest is built, not a statement
 * about the product: Map is the workspace the design system is built around
 * and the one most readers arrive for, so it leads.
 *
 * Anything not named here keeps its generated position after the listed ones,
 * so adding a workspace shows it in the rail without touching this file --
 * the list decides what goes first, not what is allowed to exist.
 */
export const WORKSPACE_ORDER = [
  "map-workspace",
  "datahub-workspace",
  "reports-workspace",
];

export function orderWorkspaces<T extends { name: string }>(items: T[]): T[] {
  const rank = (name: string) => {
    const i = WORKSPACE_ORDER.indexOf(name);
    return i === -1 ? WORKSPACE_ORDER.length : i;
  };
  return [...items].sort((a, b) => rank(a.name) - rank(b.name));
}

export type Workspace = (typeof Blocks)[string];
