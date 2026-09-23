"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/registry/vianova/ui/carousel";
import { Card, CardContent } from "@/registry/vianova/ui/card";

export default function CarouselDefault() {
  return (
    <Carousel className="w-full max-w-xs">
      <CarouselContent>
        {["Trips", "Duration", "Distance"].map((m) => (
          <CarouselItem key={m}>
            <Card>
              <CardContent className="flex h-24 items-center justify-center text-sm font-medium">
                {m}
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
