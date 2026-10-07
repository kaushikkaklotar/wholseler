import { money } from "@wholesale/shared";
export type CatalogSnapshot = {
  name: string; sku: string; category: string; description: string;
  pricePaise: number; cartonPricePaise: number | null; cartonUnits: number;
  moq: number; visibility: string; tags: string[]; imageIds: string[];
  variants: { size: string; color: string }[];
};
type SnapshotSource = Omit<CatalogSnapshot, "imageIds"> & { images: { id: string }[] };
export function catalogSnapshot(p: SnapshotSource): CatalogSnapshot {
  return { name: p.name, sku: p.sku, category: p.category, description: p.description,
    pricePaise: p.pricePaise, cartonPricePaise: p.cartonPricePaise, cartonUnits: p.cartonUnits,
    moq: p.moq, visibility: p.visibility, tags: [...p.tags].sort(),
    imageIds: p.images.map(i => i.id).sort(),
    variants: p.variants.map(v => ({ size: v.size, color: v.color })).sort((a,b) => `${a.size}\0${a.color}`.localeCompare(`${b.size}\0${b.color}`)) };
}
const labels: Record<keyof CatalogSnapshot, string> = {
  name: "Product name", sku: "SKU", category: "Category", description: "Description",
  pricePaise: "Unit price", cartonPricePaise: "Carton price", cartonUnits: "Units per carton",
  moq: "Minimum order", visibility: "Price visibility", tags: "Tags", imageIds: "Photos", variants: "Variants",
};
function display(field: keyof CatalogSnapshot, value: CatalogSnapshot[keyof CatalogSnapshot]): string {
  if (value === null) return "Not set";
  if (field === "pricePaise" || field === "cartonPricePaise") return money(value as number);
  if (field === "imageIds") return `${(value as string[]).length} photos`;
  if (field === "variants") return (value as CatalogSnapshot["variants"]).map(v => `${v.size} / ${v.color}`).join(", ") || "None";
  if (Array.isArray(value)) return value.join(", ") || "None";
  return String(value) || "Not set";
}
export function catalogChanges(before: CatalogSnapshot | null, after: CatalogSnapshot) {
  if (!before) return [];
  return (Object.keys(labels) as (keyof CatalogSnapshot)[])
    .filter(field => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map(field => ({ field, label: labels[field], before: display(field, before[field]), after: display(field, after[field]) }));
}
export function catalogDetails(snapshot: CatalogSnapshot) {
  return (Object.keys(labels) as (keyof CatalogSnapshot)[]).filter(field => field !== "imageIds")
    .map(field => ({ label: labels[field], value: display(field, snapshot[field]) }));
}
export function imageChanges(before: CatalogSnapshot | null, after: CatalogSnapshot) {
  return {
    added: after.imageIds.filter(id => !before?.imageIds.includes(id)),
    removed: (before?.imageIds || []).filter(id => !after.imageIds.includes(id)),
    retained: after.imageIds.filter(id => before?.imageIds.includes(id)),
  };
}
export function changeSummary(before: CatalogSnapshot | null, after: CatalogSnapshot) {
  if (!before) return "New product submitted";
  const changes = catalogChanges(before, after), images = imageChanges(before, after);
  return changes.map(c => c.field === "imageIds"
    ? `Photos: ${images.added.length} added, ${images.removed.length} removed (${before.imageIds.length} → ${after.imageIds.length})`
    : c.label).join(" · ") || "No catalog changes";
}
