"use client";

import { SankeyFlow } from "@/registry/vianova/product/sankey-flow";

/** Morning-peak trips between Paris districts, origin on the left. */
const NODES = [
  { id: "montparnasse", label: "Montparnasse" },
  { id: "saint-germain", label: "Saint-Germain" },
  { id: "bastille", label: "Bastille" },
  { id: "chatelet", label: "Châtelet–Les Halles" },
  { id: "opera", label: "Opéra" },
  { id: "montmartre", label: "Montmartre" },
  { id: "marais", label: "Le Marais" },
  { id: "champs", label: "Champs-Élysées" },
  { id: "republique", label: "République" },
  { id: "gare-du-nord", label: "Gare du Nord" },
];

const LINKS = [
  { source: "montparnasse", target: "montparnasse", value: 420 },
  { source: "montparnasse", target: "champs", value: 610 },
  { source: "montparnasse", target: "chatelet", value: 530 },
  { source: "saint-germain", target: "saint-germain", value: 310 },
  { source: "saint-germain", target: "marais", value: 480 },
  { source: "saint-germain", target: "chatelet", value: 600 },
  { source: "bastille", target: "republique", value: 720 },
  { source: "bastille", target: "marais", value: 520 },
  { source: "bastille", target: "gare-du-nord", value: 480 },
  { source: "chatelet", target: "chatelet", value: 900 },
  { source: "chatelet", target: "gare-du-nord", value: 760 },
  { source: "chatelet", target: "champs", value: 750 },
  { source: "opera", target: "champs", value: 510 },
  { source: "opera", target: "chatelet", value: 540 },
  { source: "opera", target: "bastille", value: 420 },
  { source: "montmartre", target: "republique", value: 560 },
  { source: "montmartre", target: "gare-du-nord", value: 580 },
  { source: "montmartre", target: "montparnasse", value: 410 },
  { source: "marais", target: "marais", value: 340 },
  { source: "marais", target: "republique", value: 270 },
  { source: "marais", target: "saint-germain", value: 380 },
  { source: "marais", target: "bastille", value: 550 },
  { source: "marais", target: "montparnasse", value: 300 },
];

export default function SankeyFlowDefault() {
  return (
    <div className="h-[460px] w-full">
      <SankeyFlow nodes={NODES} links={LINKS} />
    </div>
  );
}
