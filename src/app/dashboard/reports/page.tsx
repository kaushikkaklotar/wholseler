import { PageHeader } from "@/components/page-header";
import { MetricCard } from "@/components/metric-card";

const reportCards = [
  { label: "Daily sales", value: "Rs. 3.2L", trend: "94 invoices" },
  { label: "Top category", value: "Womenswear", trend: "41% of sales" },
  { label: "Low stock SKUs", value: "18", trend: "Need review" },
  { label: "Staff billing", value: "Rahul", trend: "62 bills today" }
];

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Business summaries"
        description="Useful owner reports for sales, stock movement, staff billing and seller inquiries."
      />
      <section className="metric-grid">
        {reportCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>
    </>
  );
}
