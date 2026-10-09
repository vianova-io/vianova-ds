import { WorkspaceRail } from "@/components/workspace-rail";
import { orderWorkspaces } from "@/lib/workspaces";
import { Blocks } from "@/__registry__";

/**
 * The workspace rail, scoped to /blocks the way the component rail is scoped
 * to /components.
 *
 * Same shape as that layout on purpose -- a 13rem aside that only appears from
 * `lg`, sticky under the 57px header, with the content column `min-w-0` beside
 * it. Below `lg` the rail is gone entirely rather than stacked: a phone has
 * 327px of width, the workspaces are the widest thing on the site, and the
 * index page already lists all three at the top of the scroll.
 *
 * Server component, so the registry is read at build time and the three titles
 * are not shipped twice.
 */
export default function BlocksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspaces = orderWorkspaces(Object.values(Blocks)).map((b) => ({
    name: b.name,
    title: b.title,
  }));

  return (
    <div className="flex gap-10">
      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="sticky top-20">
          <WorkspaceRail workspaces={workspaces} />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
