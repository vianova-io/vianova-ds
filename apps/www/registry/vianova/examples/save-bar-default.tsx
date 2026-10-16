"use client";

import * as React from "react";

import { SaveBar } from "@/registry/vianova/patterns/save-bar";
import { Field, FieldLabel } from "@/registry/vianova/ui/field";
import { Input } from "@/registry/vianova/ui/input";

export default function SaveBarDefault() {
  const [saved, setSaved] = React.useState("Central zone");
  const [name, setName] = React.useState(saved);
  const [saving, setSaving] = React.useState(false);

  const save = () => {
    setSaving(true);
    // Stands in for the request.
    setTimeout(() => {
      setSaved(name);
      setSaving(false);
    }, 600);
  };

  return (
    <div className="bg-background flex h-64 w-full max-w-md flex-col rounded-lg border">
      <div className="flex-1 p-4">
        <Field>
          <FieldLabel htmlFor="save-bar-zone-name">Zone name</FieldLabel>
          <Input
            id="save-bar-zone-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
      </div>
      <SaveBar
        dirty={name !== saved}
        saving={saving}
        onSave={save}
        onDiscard={() => setName(saved)}
        className="rounded-b-lg"
      />
    </div>
  );
}
