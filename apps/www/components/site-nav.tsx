"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import {
  BrandThemeSelect,
  ColorModeToggle,
  ThemeToggle,
} from "@/components/theme-toggle";
import { Button } from "@/registry/vianova/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/registry/vianova/ui/sheet";

/** One list, rendered twice: the desktop row and the sheet. */
const LINKS = [
  { href: "/showcase", label: "Showcase" },
  // Labelled Workspaces, route still /blocks: the path is public and the
  // registry docs link to it, so renaming the URL would break links that are
  // already out there for the sake of a word.
  { href: "/blocks", label: "Workspaces" },
  { href: "/components", label: "Components" },
  { href: "/foundations", label: "Foundations" },
  { href: "/changelog", label: "Changelog" },
] as const;

/**
 * Site navigation, in two shapes.
 *
 * The row this replaces was `flex items-center gap-5` with no responsive
 * prefix anywhere, and it measured 609px against the export: five links
 * (349px), four 20px gaps, and 160px of theme controls. The header row offers
 * it 206px at 375px, and because nothing in the shell is `overflow-hidden` the
 * surplus became document overflow -- `scrollWidth` 714 against a 375px
 * viewport, on EVERY page of the site. Two of the five links sat off-screen
 * and the whole page slid sideways under a thumb, which is also why a
 * perfectly responsive block still looked displaced on a phone.
 *
 * `lg`, not `md`, is the rung this switches on, and that is measured rather
 * than picked: the full row first fits at about 738px, but from there to 820px
 * it fits only by compressing the wordmark (95px against its natural 108px at
 * 768px), and `md` leaves exactly 0px of slack -- one label edit or a font
 * fallback puts it straight back over. `lg` is also the breakpoint the map
 * blocks switch on, so the site has one "compact" threshold instead of two.
 */
export function SiteNav() {
  const [open, setOpen] = React.useState(false);

  // A sheet opened on a phone and then widened past `lg` would sit over a
  // header that now lists the same links inline. The trigger going
  // `display:none` does not close the dialog it opened, so close it here.
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const close = () => {
      if (query.matches) setOpen(false);
    };
    query.addEventListener("change", close);
    return () => query.removeEventListener("change", close);
  }, []);

  return (
    <>
      <nav
        aria-label="Main"
        className="hidden items-center gap-5 text-sm lg:flex"
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
        <ThemeToggle />
      </nav>

      <div
        data-slot="site-nav-compact"
        className="flex items-center gap-2 lg:hidden"
      >
        <ColorModeToggle />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={<Button variant="outline" size="icon-sm" aria-label="Menu" />}
          >
            <Menu />
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            {/* Unlabelled on purpose: it is the only nav in the a11y tree
                while the sheet is open -- the row above is `display:none` --
                and the dialog it sits in is already named "Menu". */}
            <nav className="flex flex-col px-2">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  // Client-side navigation does not unmount the layout, so the
                  // sheet would stay open over the page it just moved to.
                  onClick={() => setOpen(false)}
                  // 44px, not the 24px of WCAG 2.5.8 that the rest of the site
                  // is gated on: this is a list of five destinations meant for
                  // a thumb, not dense toolbar chrome, so there is no height
                  // ladder to respect here and no reason to be stingy.
                  className="flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <SheetFooter className="border-t border-border">
              <BrandThemeSelect className="w-full" />
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
