import { Search } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/registry/vianova/ui/input-group";

export default function InputGroupDefault() {
  return (
    <div className="w-full max-w-sm space-y-3">
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput placeholder="Search districts" />
      </InputGroup>
      <InputGroup>
        <InputGroupInput placeholder="250" />
        <InputGroupAddon align="inline-end">
          <InputGroupText>trips/h</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
