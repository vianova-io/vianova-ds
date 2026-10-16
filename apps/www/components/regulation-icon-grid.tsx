"use client";

import { Download } from "lucide-react";

import { CopyButton } from "@/registry/vianova/patterns/copy-button";
import {
  REGULATION_TYPE_ICONS,
  regulationTypeIconSvg,
  type RegulationTypeIconName,
} from "@/registry/vianova/product/regulation-type-icons";
import {
  RULE_TYPE_ORDER,
  RULE_TYPES,
  RuleTypeIcon,
  type RuleType,
} from "@/registry/vianova/product/rule-type-icon";

/** Which icon each rule type wears; the names are the icon set's own. */
const BY_TYPE: Record<RuleType, RegulationTypeIconName> = {
  cap: "cap",
  cap_and_floor: "cap-and-floor",
  fees_subsidies: "fees",
  floor: "floor",
  low_speed: "low-speed",
  max_parked: "max-parked",
  max_unavailable: "max-unavailable",
  no_go: "no-go",
  no_parking: "no-parking",
  parking: "parking",
  operator_no_deployment: "no-deployment",
  multi_parking: "multi-parking",
};

const pascal = (kebab: string) =>
  "Regulation" + kebab.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());

/** A data: URL rather than a Blob, so the link works before hydration too. */
const svgHref = (name: RegulationTypeIconName) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(regulationTypeIconSvg(name))}`;

/**
 * The custom regulation type icons, one tile per rule type: the bare glyph as a
 * Lucide icon, and the same glyph in the product's badge.
 *
 * Same tile as the Lucide browser above it on purpose -- these are meant to be
 * read as part of that set, not as a separate family -- with a download added,
 * because the reason to come here is often to take the SVG into Figma.
 */
export function RegulationIconGrid() {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-1">
      {RULE_TYPE_ORDER.map((type) => {
        const name = BY_TYPE[type];
        const Icon = REGULATION_TYPE_ICONS[name];
        return (
          <li
            key={type}
            className="hover:bg-accent group relative flex flex-col items-center gap-2 rounded-lg border border-transparent p-3 transition-colors hover:border-border"
          >
            <div className="flex items-center gap-3">
              <Icon aria-hidden className="size-6" />
              <RuleTypeIcon type={type} size="md" />
            </div>
            <div className="w-full text-center">
              <p className="truncate text-xs font-medium">{RULE_TYPES[type].label}</p>
              <p className="text-muted-foreground truncate text-[10px]" title={pascal(name)}>
                {pascal(name)}
              </p>
            </div>
            <div className="absolute top-1 right-1 flex opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              <a
                href={svgHref(name)}
                download={`regulation-${name}.svg`}
                aria-label={`Download ${RULE_TYPES[type].label} SVG`}
                className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 inline-flex size-6 items-center justify-center rounded-md focus-visible:ring-[3px] focus-visible:outline-none"
              >
                <Download aria-hidden className="size-3.5" />
              </a>
              <CopyButton
                value={`import { ${pascal(name)} } from "@/components/ui/regulation-type-icons";`}
                label={`Copy import for ${RULE_TYPES[type].label}`}
                className="size-6"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
