import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/registry/vianova/ui/accordion";

export default function AccordionDefault() {
  return (
    <Accordion className="w-full">
      <AccordionItem value="source">
        <AccordionTrigger>Data source</AccordionTrigger>
        <AccordionContent>
          GBFS feeds from six operators, refreshed every 60 seconds.
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="method">
        <AccordionTrigger>Aggregation method</AccordionTrigger>
        <AccordionContent>
          Trips are snapped to district polygons, then binned by quantile.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
