"use client";
import useSWR from "swr";
import { ArrowUpRight, MapPin, Phone, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, ErrorState, Loading } from "@/components/common";
import { date } from "@/lib/api";

type Listing = {
  id: string;
  name: string;
  phone: string;
  city: string;
  marketArea: string;
  address: string;
  categories: string[];
  description: string;
  website: string;
  sourceUrl: string;
  checkedAt: string;
};
export function SupplierDirectory({ query = "", category = "", city = "" }: { query?: string; category?: string; city?: string }) {
  const { data, error, mutate } = useSWR<Listing[]>(`/marketplace/suppliers?${new URLSearchParams({ q: query, category, city })}`);
  return (
    <section id="supplier-directory" className="scroll-mt-24">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Surat business directory</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">Meet your next wholesale supplier.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Business contacts and collections from supplier websites. Confirm current prices, availability and order terms directly with the supplier.</p>
      </div>
      {error ? <ErrorState error={error} retry={() => void mutate()} /> : !data ? <Loading /> : !data.length ? <Empty title="No matching listed suppliers" description="Try another business name, category or market." /> : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((supplier) => (
            <article key={supplier.id} className="flex min-w-0 flex-col rounded-2xl border bg-card p-6">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Store className="size-5" /></div>
                <div className="min-w-0"><h3 className="text-base font-semibold">{supplier.name}</h3><p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 size-3 shrink-0" />{supplier.marketArea}, {supplier.city}</p></div>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{supplier.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">{supplier.categories.map((name) => <span key={name} className="rounded-md bg-muted px-2 py-1 text-xs">{name}</span>)}</div>
              <p className="mb-5 mt-4 text-xs leading-6 text-muted-foreground">{supplier.address}</p>
              <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
                <Button asChild size="sm"><a href={`tel:+91${supplier.phone}`} aria-label={`Call ${supplier.name}`}><Phone />Call supplier</a></Button>
                <Button asChild variant="outline" size="sm"><a href={supplier.website} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${supplier.name} website`}>Website<ArrowUpRight /></a></Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground"><a href={supplier.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Source</a> · Checked {date(supplier.checkedAt, { year: "numeric" })}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
