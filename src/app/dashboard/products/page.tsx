import { PageHeader } from "@/components/page-header";
import { SimpleTable } from "@/components/simple-table";
import { StatusBadge } from "@/components/status-badge";
import { products } from "@/lib/demo-data";

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products and stock"
        description="Fast product listing with SKU, category, price visibility and current stock."
        action={<button className="button button--primary">Bulk upload</button>}
      />
      <section className="card">
        <div className="card__header">
          <div>
            <h2>Product catalog</h2>
            <p>Designed for quick daily uploads and stock review.</p>
          </div>
          <div className="toolbar">
            <button className="button button--secondary">Add product</button>
            <button className="button button--secondary">Download template</button>
          </div>
        </div>
        <div className="card__body">
          <SimpleTable
            data={products}
            columns={[
              { label: "SKU", render: (item) => item.sku },
              { label: "Product", render: (item) => item.name },
              { label: "Category", render: (item) => item.category },
              { label: "Stock", render: (item) => item.stock },
              { label: "Price", render: (item) => item.price },
              { label: "Visibility", render: (item) => <StatusBadge label={item.visibility} /> }
            ]}
          />
        </div>
      </section>
    </>
  );
}
