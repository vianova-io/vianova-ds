"use client";

import { toast } from "sonner";

import { Button } from "@/registry/vianova/ui/button";

export default function SonnerDefault() {
  return (
    <Button
      variant="outline"
      onClick={() => toast.success("Export ready", { description: "le-havre-od.csv" })}
    >
      Show toast
    </Button>
  );
}
