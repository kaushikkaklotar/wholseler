import { PageHeader } from "@/components/page-header";
import { SimpleTable } from "@/components/simple-table";
import { inquiries } from "@/lib/demo-data";

export default function SellersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Seller discovery"
        title="Inquiries and buyer history"
        description="MVP keeps seller flow fast: search, product reference, call or WhatsApp, then bill from the wholesaler side."
        action={<button className="button button--primary">Add buyer note</button>}
      />
      <section className="card">
        <div className="card__header">
          <div>
            <h2>Inquiry log</h2>
            <p>Captured contacts become useful buyer history for repeat sales.</p>
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
