import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogSnapshot, catalogChanges, imageChanges, changeSummary } from "../apps/api/src/catalog-review";
const original = catalogSnapshot({ name: "Toy", sku: "TOY-01", category: "Toys", description: "Wooden toy", pricePaise: 50000, cartonPricePaise: null, cartonUnits: 12, moq: 1, visibility: "PUBLIC", tags: ["Wood", "New"], images: [{ id: "old" }], variants: [{ size: "M", color: "Blue" }, { size: "L", color: "Red" }] });
test("Catalog comparison identifies added/removed photos and exact changed values", () => {
  const changed = { ...original, imageIds: ["old", "a", "b", "c", "d", "e"], pricePaise: 60000 };
  assert.equal(imageChanges(original, changed).added.length, 5);
  assert.deepEqual(imageChanges(original, changed).retained, ["old"]);
  assert.match(changeSummary(original, changed), /5 added, 0 removed \(1 → 6\)/);
  const price = catalogChanges(original, changed).find(row => row.field === "pricePaise")!;
  assert.match(price.before, /500/); assert.match(price.after, /600/);
  assert.deepEqual(imageChanges(changed, original).removed, ["a", "b", "c", "d", "e"]);
});
test("Catalog snapshots ignore ordering, stock and internal alert thresholds", () => {
  const reordered = catalogSnapshot({ ...original, images: original.imageIds.map(id => ({ id })), tags: [...original.tags].reverse(), variants: original.variants.map(v => ({ ...v, stock: 999, lowStockAt: 50 })).reverse() });
  assert.deepEqual(catalogChanges(original, reordered), []);
  assert.equal(changeSummary(original, reordered), "No catalog changes");
});
