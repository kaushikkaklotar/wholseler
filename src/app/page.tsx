import Link from "next/link";

import { MetricCard } from "@/components/metric-card";
import { sampleMetrics } from "@/lib/demo-data";

export default function HomePage() {
  return (
    <main className="landing">
      <section className="landing__hero">
        <div className="eyebrow">Wholesale Commerce System</div>
        <h1>One calm operating system for catalog, stock, billing and seller discovery.</h1>
        <p>
          Built for wholesalers who need fast product uploads, controlled staff access,
          cleaner billing and searchable product discovery for sellers.
        </p>
        <div className="landing__actions">
          <Link className="button button--primary" href="/dashboard">
            Open owner dashboard
          </Link>
          <Link className="button button--secondary" href="/dashboard/staff">
            Manage staff permissions
          </Link>
        </div>
      </section>

      <section className="metric-grid" aria-label="System overview">
        {sampleMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>
    </main>
  );
}
