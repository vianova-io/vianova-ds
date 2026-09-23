import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/registry/vianova/ui/field";
import { Input } from "@/registry/vianova/ui/input";

export default function FieldDefault() {
  return (
    <FieldGroup className="w-full max-w-sm">
      <Field>
        <FieldLabel htmlFor="zone-name">Zone set name</FieldLabel>
        <Input id="zone-name" defaultValue="Le Havre — 54 districts" />
        <FieldDescription>Shown wherever this boundary set is used.</FieldDescription>
      </Field>
    </FieldGroup>
  );
}
