import { PageHeader } from "@/components/page-header";
import { SimpleTable } from "@/components/simple-table";
import { StatusBadge } from "@/components/status-badge";
import { invoices, products } from "@/lib/demo-data";

export default function BillingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Counter billing"
        title="Invoice workspace"
        description="Generate counter bills and keep inventory as the source of truth after every sale."
        action={<button className="button button--primary">New invoice</button>}
      />
      <section className="content-grid">
        <article className="card">
          <div className="card__header">
            <div>
              <h2>Create invoice</h2>
              <p>Simple billing flow for staff with stock deduction after issue.</p>
            </div>
          </div>
          <form className="card__body form-card">
            <div className="form-row">
              <div className="field">
                <label htmlFor="buyer">Buyer</label>
                <input id="buyer" placeholder="Seller or walk-in buyer" />
              </div>
              <div className="field">
                <label htmlFor="payment">Payment mode</label>
                <select id="payment" defaultValue="UPI">
                  <option>UPI</option>
                  <option>Cash</option>
                  <option>Bank transfer</option>
                  <option>Credit</option>
                </select>
              </div>
            </div>
            <SimpleTable
              data={products.slice(0, 3)}
              columns={[
                { label: "Product", render: (item) => item.name },
                { label: "Stock", render: (item) => item.stock },
                { label: "Rate", render: (item) => item.price }
              ]}
            />
            <button className="button button--primary" type="button">
              Issue invoice
            </button>
          </form>
        </article>

        <article className="card">
          <div className="card__header">
            <div>
              <h2>Recent bills</h2>
              <p>Payment status can be marked manually in MVP.</p>
            </div>
          </div>
          <div className="card__body">
            <SimpleTable
              data={invoices}
              columns={[
                { label: "Bill", render: (item) => item.number },
                { label: "Buyer", render: (item) => item.buyer },
                { label: "Status", render: (item) => <StatusBadge label={item.status} /> }
              ]}
            />
          </div>
        </article>
      </section>
    </>
  );
}
