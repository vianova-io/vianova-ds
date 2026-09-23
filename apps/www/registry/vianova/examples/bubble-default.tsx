import { Bubble, BubbleContent, BubbleGroup } from "@/registry/vianova/ui/bubble";

export default function BubbleDefault() {
  return (
    <BubbleGroup className="w-full">
      <Bubble>
        <BubbleContent>Show me OD flows for the port.</BubbleContent>
      </Bubble>
      <Bubble>
        <BubbleContent>1,204 pairs found. Top flow is Port → City centre.</BubbleContent>
      </Bubble>
    </BubbleGroup>
  );
}
