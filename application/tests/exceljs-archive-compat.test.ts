import { it, expect } from "vitest";
import ExcelJS from "exceljs";
import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { finished } from "node:stream/promises";

const require = createRequire(import.meta.url);

it("keeps ExcelJS XLSX exports usable after the glob security overrides", async () => {
 const workbook = new ExcelJS.Workbook();
 workbook.addWorksheet("Resultados").addRow(["Total MZN", 120]);
 const bytes = Buffer.from(await workbook.xlsx.writeBuffer());
 expect(bytes.subarray(0, 2).toString()).toBe("PK");
 expect(bytes.length).toBeGreaterThan(500);
}, 30000);

it("keeps Archiver directory ZIP generation working with the patched matcher", async () => {
 const directory = await mkdtemp(join(tmpdir(), "pcc-zip-"));
 try {
  await writeFile(join(directory, "documento.txt"), "Evidência de ensaio PCC");
  const archiver = require("archiver") as (type: string) => {
   directory: (path: string, dest: boolean) => void;
   pipe: (destination: Writable) => void;
   finalize: () => Promise<void>;
   on: (event: string, callback: (error: Error) => void) => void;
  };
  const archive = archiver("zip");
  const chunks: Buffer[] = [];
  const output = new Writable({
   write(chunk: Buffer, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); },
  });
  archive.on("error", (error) => output.destroy(error));
  archive.pipe(output);
  archive.directory(directory, false);
  await archive.finalize();
  await finished(output);
  const result = Buffer.concat(chunks);
  expect(result.subarray(0, 2).toString()).toBe("PK");
  expect(result.length).toBeGreaterThan(40);
 } finally { await rm(directory, { recursive: true, force: true }); }
}, 30000);
