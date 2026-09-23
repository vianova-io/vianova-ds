import { CopyButton } from "@/components/copy-button";
import { highlight } from "@/lib/source";
import { cn } from "@/registry/vianova/lib/utils";

export async function CodeBlock({
  code,
  lang = "tsx",
  className,
  maxHeight = true,
}: {
  code: string;
  lang?: string;
  className?: string;
  maxHeight?: boolean;
}) {
  const html = await highlight(code, lang);

  return (
    <div className={cn("group relative", className)}>
      <CopyButton
        value={code}
        className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      />
      <div
        // Wide code must scroll inside its own container, never the page.
        className={cn(
          "shiki-host overflow-x-auto rounded-lg border border-border bg-surface-sunken text-[13px] leading-relaxed [&_pre]:!bg-transparent [&_pre]:p-4",
          maxHeight && "max-h-[32rem] overflow-y-auto",
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
