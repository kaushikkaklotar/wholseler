"use client";
import dynamic from "next/dynamic";
import type { DailySales } from "@/lib/types";
const Chart = dynamic(
  () => import("./sales-chart-renderer").then((module) => module.SalesChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="h-56 animate-pulse rounded-lg bg-muted/40"
        aria-label="Loading sales chart"
      />
    ),
  },
);
export function SalesChart(props: { data: DailySales[]; height?: number }) {
  return <Chart {...props} />;
}
