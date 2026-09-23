import * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/registry/vianova/ui/card";
import { cn } from "@/registry/vianova/lib/utils";

/**
 * A card with the header/action/footer arrangement a settings or detail page
 * repeats a dozen times.
 *
 * Card itself stays unopinionated on purpose, so every consumer re-derives the
 * same header row. This fixes the arrangement once; reach past it to Card when
 * the layout is genuinely different rather than adding props here.
 */
export function SectionCard({
  title,
  description,
  action,
  footer,
  contentClassName,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Card>, "title"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <Card data-slot="section-card" className={cn("gap-0 py-0", className)} {...props}>
      {title || description || action ? (
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b py-4">
          <div className="min-w-0 space-y-1">
            {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className={cn("py-4", contentClassName)}>{children}</CardContent>
      {footer ? (
        <CardFooter className="bg-muted/40 justify-end gap-2 border-t py-3">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}
