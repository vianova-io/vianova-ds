"use client";

import * as React from "react";

import { SliderField } from "@/registry/vianova/patterns/slider-field";

export default function SliderFieldDefault() {
  const [buffer, setBuffer] = React.useState(10);
  const [radius, setRadius] = React.useState(25);

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <SliderField
        label="GPS buffer"
        description="Widens or narrows the zone to absorb GPS drift."
        value={buffer}
        onValueChange={setBuffer}
        min={-20}
        max={20}
        unit="m"
        marks={[-20, 0, 10, 20]}
        recommended={10}
      />
      <SliderField
        label="Zone radius"
        value={radius}
        onValueChange={setRadius}
        min={0}
        max={100}
        step={5}
        unit="m"
        marks={[0, 50, 100]}
      />
    </div>
  );
}
