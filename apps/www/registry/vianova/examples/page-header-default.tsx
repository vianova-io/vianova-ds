import { Download, Plus } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/registry/vianova/ui/breadcrumb";
import { Button } from "@/registry/vianova/ui/button";
import { PageHeader } from "@/registry/vianova/patterns/page-header";

export default function PageHeaderDefault() {
  return (
    <PageHeader
      className="w-full"
      title="Le Havre — origin/destination"
      description="Weekday trips between the 54 districts, aggregated over March 2026."
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">Studies</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Le Havre</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      actions={
        <>
          <Button variant="outline" size="sm">
            <Download /> Export
          </Button>
          <Button size="sm">
            <Plus /> New view
          </Button>
        </>
      }
    />
  );
}
