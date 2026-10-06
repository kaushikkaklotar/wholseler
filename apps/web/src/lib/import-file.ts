import Papa from "papaparse";
export const normalizeHeader = (v: string) =>
  v.trim().toLowerCase().replace(/\s+/g, "_");
export async function readImportFile(
  file: File,
): Promise<Record<string, string>[]> {
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Choose a file smaller than 5 MB");
  if (/\.xlsx$/i.test(file.name)) {
    // Validate uncompressed size before handing the workbook to the parser.
    const { unzipSync } = await import("fflate");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let total = 0,
      entries = 0;
    unzipSync(bytes, {
      filter: (f) => {
        total += f.originalSize;
        entries++;
        if (total > 40 * 1024 * 1024 || entries > 2000)
          throw new Error("Workbook is too large. Export a smaller sheet.");
        return false;
      },
    });
    const { readSheet } = await import("read-excel-file/browser");
    const data = await readSheet(file);
    if (!data.length) throw new Error("The first sheet is empty");
    const headers = data[0].map((cell) => normalizeHeader(String(cell ?? "")));
    if (headers.some((h) => !h) || new Set(headers).size !== headers.length)
      throw new Error("Column headers must be non-empty and unique");
    const rows = data
      .slice(1)
      .filter((r) => r.some((c) => c !== null && c !== ""));
    if (rows.length > 500)
      throw new Error("One import supports up to 500 variant rows");
    return rows.map((r) =>
      Object.fromEntries(
        headers.map((h, i) => [h, r[i] == null ? "" : String(r[i])]),
      ),
    );
  }
  if (!/\.csv$/i.test(file.name))
    throw new Error("Choose an Excel .xlsx or CSV file");
  const result = Papa.parse<Record<string, string>>(await file.text(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });
  const fields = result.meta.fields || [];
  if (
    fields.some((h) => !h) ||
    Object.keys(result.meta.renamedHeaders || {}).length
  )
    throw new Error("Column headers must be non-empty and unique");
  if (result.errors.length)
    throw new Error(result.errors.map((e) => e.message).join("; "));
  if (result.data.length > 500)
    throw new Error("One import supports up to 500 variant rows");
  return result.data;
}
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const url = URL.createObjectURL(
    new Blob([Papa.unparse(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
export async function readImageFiles(files: FileList | File[]) {
  const images: File[] = [];
  for (const file of Array.from(files)) {
    if (/\.zip$/i.test(file.name)) {
      if (file.size > 50 * 1024 * 1024)
        throw new Error("Image ZIP must be smaller than 50 MB");
      const { unzip } = await import("fflate");
      let total = 0,
        entries = 0;
      const extracted = await new Promise<Record<string, Uint8Array>>(
        (resolve, reject) => {
          void file.arrayBuffer().then((buf) => {
            try {
              unzip(
                new Uint8Array(buf),
                {
                  filter: (info) => {
                    if (
                      !/\.(jpe?g|png|webp)$/i.test(info.name) ||
                      info.name.startsWith("__MACOSX/")
                    )
                      return false;
                    total += info.originalSize;
                    entries++;
                    if (
                      info.originalSize > 8 * 1024 * 1024 ||
                      total > 200 * 1024 * 1024 ||
                      entries > 200
                    )
                      throw new Error(
                        "ZIP supports up to 200 images, 8 MB each, and 200 MB uncompressed",
                      );
                    return true;
                  },
                },
                (error, data) => (error ? reject(error) : resolve(data)),
              );
            } catch (e) {
              reject(e);
            }
          }, reject);
        },
      );
      for (const [path, bytes] of Object.entries(extracted)) {
        const name = path.split(/[\\/]/).at(-1)!;
        const type = /\.png$/i.test(name)
          ? "image/png"
          : /\.webp$/i.test(name)
            ? "image/webp"
            : "image/jpeg";
        images.push(new File([new Uint8Array(bytes)], name, { type }));
      }
    } else {
      if (
        !/\.(jpe?g|png|webp)$/i.test(file.name) ||
        file.size > 8 * 1024 * 1024
      )
        throw new Error("Choose JPEG, PNG or WebP images, up to 8 MB each");
      images.push(file);
    }
  }
  if (
    images.length > 200 ||
    images.reduce((s, f) => s + f.size, 0) > 200 * 1024 * 1024
  )
    throw new Error("Choose up to 200 images and 200 MB in total");
  if (new Set(images.map((f) => f.name.toLowerCase())).size !== images.length)
    throw new Error(
      "Image file names must be unique, including inside ZIP folders",
    );
  return images;
}
