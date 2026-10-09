import { LegendCategorical } from "@/registry/vianova/product/legend-categorical";

/** Stand-in logos: generic marks, so no example carries anyone's trademark. */
const mark = (body: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`,
  )}`;

const VEHICLES = [
  {
    label: "Scooters",
    color: "#0f766e",
    logo: { src: mark('<path d="M36 6 14 36h14l-4 22 26-34H34z" fill="#ffffff"/>') },
  },
  {
    label: "Bikes",
    color: "#2563eb",
    // The dot stays blue to tell it apart far out; the logo sits on white to be read close up.
    logo: {
      src: mark('<circle cx="32" cy="32" r="21" fill="none" stroke="#111827" stroke-width="9"/>'),
      background: "#ffffff",
    },
  },
  {
    label: "Docked bikes",
    color: "#7c3aed",
    logo: {
      src: mark('<rect width="64" height="64" fill="#facc15"/><path d="M14 48 32 14l18 34z" fill="#111827"/>'),
      solid: true,
    },
  },
  // No logo: it is a dot at every zoom, as it is on the map.
  { label: "Mopeds", color: "#d97706" },
];

export default function LegendCategoricalLogos() {
  return (
    <div className="w-full max-w-xs space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Zoomed out: colour dots</p>
        <LegendCategorical items={VEHICLES} />
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Zoomed in: logos where there is one</p>
        <LegendCategorical items={VEHICLES} showLogos />
      </div>
    </div>
  );
}
