import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { SimpleTable } from "@/components/simple-table";
import { StatusBadge } from "@/components/status-badge";
import { inquiries, invoices, products, sampleMetrics } from "@/lib/demo-data";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Owner overview"
        title="Daily control room"
        description="Track stock, billing, seller inquiries and team activity from one clean workspace."
        action={<button className="button button--primary">Add product</button>}
      />

      <section className="metric-grid" aria-label="Metrics">
        {sampleMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="content-grid section-gap">
        <article className="card">
          <div className="card__header">
            <div>
              <h2>Low stock watch</h2>
              <p>Products that need purchase entry or stock correction.</p>
            </div>
            <button className="button button--secondary">Export</button>
          </div>
          <div className="card__body">
            <SimpleTable
              data={products.filter((product) => product.stock < 200)}
              columns={[
                { label: "SKU", render: (item) => item.sku },
                { label: "Product", render: (item) => item.name },
                { label: "Stock", render: (item) => item.stock },
                { label: "Price", render: (item) => item.price }
              ]}
            />
          </div>
        </article>

        <article className="card">
          <div className="card__header">
            <div>
              <h2>Latest invoices</h2>
              <p>Counter bills created by staff.</p>
            </div>
          </div>
          <div className="card__body">
            <SimpleTable
              data={invoices}
              columns={[
                { label: "Bill", render: (item) => item.number },
                { label: "Amount", render: (item) => item.amount },
                { label: "Status", render: (item) => <StatusBadge label={item.status} /> }
              ]}
            />
          </div>
        </article>
      </section>

      <section className="card section-gap">
        <div className="card__header">
          <div>
            <h2>Seller inquiries</h2>
            <p>Call and WhatsApp requests captured for follow-up.</p>
          </div>
        </div>
        <div className="card__body">
          <SimpleTable
            data={inquiries}
            columns={[
              { label: "Seller", render: (item) => item.seller },
              { label: "Product", render: (item) => item.product },
              { label: "Quantity", render: (item) => item.quantity },
              { label: "Source", render: (item) => item.source }
            ]}
          />
        </div>
      </section>
    </>
  );
}
