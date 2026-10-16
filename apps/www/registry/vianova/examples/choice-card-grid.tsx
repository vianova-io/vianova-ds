import { Bike, Bus, CarFront, Footprints, TramFront, Zap } from "lucide-react";

import { ChoiceCard, ChoiceCardGroup } from "@/registry/vianova/ui/choice-card";

const MODES = [
  {
    value: "scooter",
    icon: <Zap />,
    title: "Scooters",
    description: "Shared e-scooters",
  },
  {
    value: "bike",
    icon: <Bike />,
    title: "Bikes",
    description: "Docked and dockless",
  },
  {
    value: "car",
    icon: <CarFront />,
    title: "Car sharing",
    description: "Free-floating fleets",
  },
  {
    value: "bus",
    icon: <Bus />,
    title: "Buses",
    description: "Scheduled routes",
  },
  {
    value: "tram",
    icon: <TramFront />,
    title: "Trams",
    description: "Light rail lines",
  },
  {
    value: "walk",
    icon: <Footprints />,
    title: "Walking",
    description: "Pedestrian counts",
  },
];

export default function ChoiceCardGrid() {
  return (
    <ChoiceCardGroup aria-label="Mode" defaultValue="scooter" columns={3}>
      {MODES.map((mode) => (
        <ChoiceCard key={mode.value} {...mode} />
      ))}
    </ChoiceCardGroup>
  );
}
