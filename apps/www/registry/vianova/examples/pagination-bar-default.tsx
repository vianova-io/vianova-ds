"use client";

import * as React from "react";

import { PaginationBar } from "@/registry/vianova/patterns/pagination-bar";

export default function PaginationBarDefault() {
  const [page, setPage] = React.useState(7);
  const [pageSize, setPageSize] = React.useState(25);

  const totalItems = 1284;
  const pageCount = Math.ceil(totalItems / pageSize);

  return (
    <PaginationBar
      className="w-full"
      page={Math.min(page, pageCount)}
      pageCount={pageCount}
      onPageChange={setPage}
      pageSize={pageSize}
      onPageSizeChange={(size) => {
        setPageSize(size);
        setPage(1);
      }}
      totalItems={totalItems}
    />
  );
}
