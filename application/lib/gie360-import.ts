import { createHash } from "node:crypto";
import {inflateRawSync} from "node:zlib";
import ExcelJS from "exceljs";

export const GIE_IMPORT_PARSER_VERSION = "1.0.0";
export const MAX_IMPORT_BYTES = 3 * 1024 * 1024;
const MAX_ROWS = 10_000;
const MAX_COLUMNS = 100;
export type ImportState = "received" | "in_review" | "approved" | "rejected";
export type ImportAlert = { row: number | null; field: string; code: string; severity: "error" | "warning"; message: string };
export type GIEImportRecord = {
  row: number; documentId: string; lineId: string | null; kind: "invoice" | "credit_note";
  reversesDocumentId: string | null; customer: string | null; product: string | null;
  occurredOn: string | null; currency: string | null;
  net: number | null; tax: number | null; gross: number | null; discount: number | null;
};
export type ExchangeRate = { currency: string; rateToMzn: number; date: string; source: string };
export type GIEImportSnapshot = {
  parserVersion: string; originalSha256: string; sourceName: string; sourceBytes: number;
  records: GIEImportRecord[]; alerts: ImportAlert[]; exchangeRates: ExchangeRate[];
  coverage: { rows: number; periodFrom: string | null; periodTo: string | null; datedRows: number; currencies: string[] };
  totals: { byCurrency: Record<string, { net: number | null; tax: number | null; gross: number | null }>; mzn: { net: number | null; tax: number | null; gross: number | null }; convertedRows: number };
  limitations: string[];
};
const ALIASES: Record<string, string[]> = {
  documentId: ["document_id", "documento", "numero_documento", "factura", "fatura", "invoice", "invoice_number"],
  lineId: ["line_id", "linha", "numero_linha"], kind: ["tipo", "type", "document_type"],
  reversesDocumentId: ["reverses_document_id", "documento_original", "factura_original", "original_invoice"],
  customer: ["cliente", "customer", "customer_id"], product: ["produto", "product", "product_id"],
  occurredOn: ["data", "date", "occurred_on", "document_date"], currency: ["moeda", "currency"],
  net: ["base_tributavel", "net", "subtotal", "valor_liquido"], tax: ["imposto", "tax", "iva"],
  gross: ["total", "gross", "valor_total"], discount: ["desconto", "discount"],
};
function key(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[\s-]+/g, "_"); }
function alert(alerts: ImportAlert[], row: number | null, field: string, code: string, message: string, severity: ImportAlert["severity"] = "error") {
  alerts.push({ row, field, code, severity, message });
}
function text(value: unknown): string { return value == null ? "" : String(value).trim(); }
/** Accept explicit decimal/grouping conventions, reject ambiguous 1,234 or 1.234. */
export function parseImportAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && Math.abs(value) <= 1e12 && Math.abs(value * 100 - Math.round(value * 100)) < 0.0001 ? value : null;
  const raw = text(value).replace(/[ \u00a0]/g, "");
  if (!raw || !/^-?[\d.,]+$/.test(raw)) return null;
  let normal = raw;
  if (raw.includes(",") && raw.includes(".")) {
    const decimal = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? "," : ".";
    const grouping = decimal === "," ? "." : ",";
    const parts = raw.split(decimal);
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1]) || !new RegExp(`^-?\\d{1,3}(?:\\${grouping}\\d{3})*$`).test(parts[0])) return null;
    normal = parts[0].split(grouping).join("") + "." + parts[1];
  } else if (/[,.]/.test(raw)) {
    if (!/^-?\d+[,.]\d{1,2}$/.test(raw)) return null;
    normal = raw.replace(",", ".");
  } else if (!/^-?\d+$/.test(raw)) return null;
  const amount = Number(normal);
  return Number.isFinite(amount) && Math.abs(amount) <= 1e12 ? amount : null;
}
function parseDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = text(value);
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  const iso = dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : raw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}
/** RFC4180 quoted fields/newlines, explicit rejection of malformed quotes and row overflow. */
export function parseImportCSV(csv: string): string[][] {
  const input = csv.replace(/^\uFEFF/, "");
  const firstLine = input.split(/\r?\n/, 1)[0];
  // Count candidate separators outside quoted fields, not inside a quoted customer name.
  const scores = [",", ";", "\t"].map((separator) => {
    let quoted = false; let count = 0;
    for (let i = 0; i < firstLine.length; i++) {
      if (firstLine[i] === '"') { if (quoted && firstLine[i + 1] === '"') i++; else quoted = !quoted; }
      else if (!quoted && firstLine[i] === separator) count++;
    }
    return { separator, count };
  }).sort((a, b) => b.count - a.count);
  const separator = scores[0].separator;
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false; let closed = false;
  function pushCell() { row.push(cell); cell = ""; closed = false; if (row.length > MAX_COLUMNS) throw new Error("IMPORT_TOO_MANY_COLUMNS"); }
  function pushRow() { pushCell(); if (row.some((value) => value.trim())) rows.push(row); row = []; if (rows.length > MAX_ROWS + 1) throw new Error("IMPORT_TOO_MANY_ROWS"); }
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') { if (input[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
      else cell += char;
    } else if (char === separator) pushCell();
    else if (char === "\n" || char === "\r") { if (char === "\r" && input[i + 1] === "\n") i++; pushRow(); }
    else if (char === '"' && cell === "" && !closed) quoted = true;
    else { if (closed || char === '"') throw new Error("IMPORT_INVALID_CSV_QUOTING"); cell += char; }
    if (cell.length > 2_000) throw new Error("IMPORT_CELL_TOO_LONG");
  }
  if (quoted) throw new Error("IMPORT_INVALID_CSV_QUOTING");
  if (cell || row.length || closed) pushRow();
  return rows;
}
function sum(values: Array<number | null>) { return values.some((value) => value === null) ? null : Math.round(values.reduce<number>((total, value) => total + (value ?? 0), 0) * 100) / 100; }
/** Validate actual expanded ZIP size before ExcelJS loads worksheet XML. */
function validateXLSXArchive(bytes:Uint8Array){
 const buffer=Buffer.from(bytes);let end=-1;
 for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50&&i+22+buffer.readUInt16LE(i+20)===buffer.length){end=i;break;}
 if(end<0||buffer.readUInt16LE(end+4)!==0||buffer.readUInt16LE(end+6)!==0)throw new Error("IMPORT_INVALID_XLSX_ARCHIVE");
 const entries=buffer.readUInt16LE(end+10);const directorySize=buffer.readUInt32LE(end+12);let at=buffer.readUInt32LE(end+16);let expanded=0;let actualExpanded=0;
 if(entries>256||at+directorySize>end)throw new Error("IMPORT_XLSX_ARCHIVE_LIMIT");
 const seen=new Set<string>();
 for(let i=0;i<entries;i++){
  if(at+46>buffer.length||buffer.readUInt32LE(at)!==0x02014b50)throw new Error("IMPORT_INVALID_XLSX_ARCHIVE");
  const flags=buffer.readUInt16LE(at+8),method=buffer.readUInt16LE(at+10),size=buffer.readUInt32LE(at+24),nameLength=buffer.readUInt16LE(at+28),extraLength=buffer.readUInt16LE(at+30),commentLength=buffer.readUInt16LE(at+32);
  const next=at+46+nameLength+extraLength+commentLength;if(next>buffer.length)throw new Error("IMPORT_INVALID_XLSX_ARCHIVE");
  const name=buffer.subarray(at+46,at+46+nameLength).toString("utf8");expanded+=size;
  if((flags&1)!==0||![0,8].includes(method)||size>12*1024*1024||expanded>24*1024*1024||name.startsWith("/")||name.split("/").includes("..")||seen.has(name)||/vbaProject/i.test(name))throw new Error("IMPORT_XLSX_ARCHIVE_LIMIT");
  const compressedSize=buffer.readUInt32LE(at+20),offset=buffer.readUInt32LE(at+42);
  if(offset+30>buffer.length||buffer.readUInt32LE(offset)!==0x04034b50)throw new Error("IMPORT_INVALID_XLSX_ARCHIVE");
  const dataOffset=offset+30+buffer.readUInt16LE(offset+26)+buffer.readUInt16LE(offset+28);
  if(dataOffset+compressedSize>buffer.length)throw new Error("IMPORT_INVALID_XLSX_ARCHIVE");
  const compressed=buffer.subarray(dataOffset,dataOffset+compressedSize);
  try{const inflated=method===0?compressed:inflateRawSync(compressed,{maxOutputLength:12*1024*1024});actualExpanded+=inflated.length;if(inflated.length!==size||actualExpanded>24*1024*1024)throw new Error("size");}
  catch{throw new Error("IMPORT_XLSX_ARCHIVE_LIMIT");}
  seen.add(name);at=next;
 }
}
export async function parseGIE360Import(input: Uint8Array, sourceName: string, rates: ExchangeRate[] = []): Promise<GIEImportSnapshot> {
  if (input.byteLength === 0 || input.byteLength > MAX_IMPORT_BYTES) throw new Error("IMPORT_INVALID_FILE_SIZE");
  const extension = sourceName.split(".").pop()?.toLowerCase();
  const alerts: ImportAlert[] = []; const sourceRows: number[] = []; let rows: unknown[][];
  if (extension === "csv") {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(input);
    if (decoded.includes("\0")) throw new Error("IMPORT_INVALID_CSV_ENCODING");
    rows = parseImportCSV(decoded);
  } else if (extension === "xlsx") {
    if (input[0] !== 0x50 || input[1] !== 0x4b) throw new Error("IMPORT_INVALID_XLSX_SIGNATURE");
    validateXLSXArchive(input);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(input) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("IMPORT_NO_WORKSHEET");
    if (workbook.worksheets.length > 1) alert(alerts, null, "worksheet", "FIRST_SHEET_ONLY", "Só a primeira folha foi importada; reveja as restantes folhas.", "warning");
    if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > MAX_COLUMNS) throw new Error("IMPORT_TOO_MANY_ROWS_OR_COLUMNS");
    rows = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values: unknown[] = [];
      for (let col = 1; col <= sheet.columnCount; col++) {
        const cell = row.getCell(col);
        if (cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Error) {
          alert(alerts, rowNumber, `column_${col}`, "UNTRUSTED_FORMULA", "Fórmula/erro Excel não foi usado como facto; importe valores verificados."); values.push(null);
        } else if (cell.type === ExcelJS.ValueType.Hyperlink || cell.type === ExcelJS.ValueType.RichText) values.push(cell.text);
        else values.push(cell.value);
        if (text(values.at(-1)).length > 2_000) throw new Error("IMPORT_CELL_TOO_LONG");
      }
      rows.push(values); sourceRows.push(rowNumber);
    });
  } else throw new Error("IMPORT_UNSUPPORTED_FORMAT_USE_CSV_XLSX");
  if (rows.length < 2) throw new Error("IMPORT_NO_RECORDS");
  const headers = rows[0].map((value) => key(text(value)));
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length) throw new Error("IMPORT_DUPLICATE_HEADERS");
  const columns = Object.fromEntries(Object.entries(ALIASES).map(([field, aliases]) => [field, headers.findIndex((header) => header === key(field) || aliases.includes(header))]));
  for (const required of ["documentId", "kind", "occurredOn", "currency"]) if (columns[required] < 0) alert(alerts, 1, required, "MISSING_COLUMN", `Coluna obrigatória em falta: ${required}.`);
  if (["net", "tax", "gross"].every((field) => columns[field] < 0)) alert(alerts, 1, "amount", "MISSING_AMOUNT_COLUMNS", "Faltam colunas de base tributável, imposto ou total.");
  const seen = new Set<string>();
  const records = rows.slice(1).map((values, index): GIEImportRecord => {
    const row = sourceRows[index + 1] ?? index + 2;
    const get = (field: string) => columns[field] >= 0 ? values[columns[field]] : null;
    const documentId = text(get("documentId"));
    if (!documentId || documentId.length > 200) alert(alerts, row, "documentId", "MISSING_DOCUMENT", "Identificador do documento em falta ou inválido.");
    const rawKind = key(text(get("kind")));
    const kind = ["credit_note", "nota_credito", "nota_de_credito", "nc"].includes(rawKind) ? "credit_note" : "invoice";
    if (!["credit_note", "nota_credito", "nota_de_credito", "nc", "invoice", "factura", "fatura", "ft"].includes(rawKind)) alert(alerts, row, "kind", "INVALID_KIND", "Tipo de documento não reconhecido; confirme factura ou nota de crédito.");
    const lineId = text(get("lineId")) || null;
    const duplicateKey = `${kind}\0${documentId}\0${lineId ?? ""}`;
    if (seen.has(duplicateKey)) alert(alerts, row, "documentId", "DUPLICATE_RECORD", "Documento/linha duplicado; não aprovar totais sem reconciliação.");
    seen.add(duplicateKey);
    const occurredOn = parseDate(get("occurredOn"));
    if (!occurredOn) alert(alerts, row, "occurredOn", "INVALID_DATE", "Data em falta ou inválida; use AAAA-MM-DD ou DD/MM/AAAA.");
    const rawCurrency = text(get("currency")).toUpperCase();
    const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : null;
    if (!currency) alert(alerts, row, "currency", "INVALID_CURRENCY", "Moeda explícita ISO de três letras em falta ou inválida.");
    function amount(field: string): number | null {
      const raw = get(field);
      if (text(raw) === "") return null;
      const value = parseImportAmount(raw);
      if (value === null) { alert(alerts, row, field, "INVALID_AMOUNT", "Valor inválido ou separador decimal ambíguo."); return null; }
      if (field === "discount") {
        if (value < 0) alert(alerts, row, field, "INVALID_DISCOUNT", "Desconto deve ser não negativo e declarado separadamente.");
        return value;
      }
      if (kind === "invoice" && value < 0) alert(alerts, row, field, "NEGATIVE_INVOICE", "Factura negativa requer classificação/reversão explícita.");
      return kind === "credit_note" ? -Math.abs(value) : value;
    }
    const net = amount("net"), tax = amount("tax"), gross = amount("gross"), discount = amount("discount");
    if ([net, tax, gross].every((value) => value === null)) alert(alerts, row, "amount", "MISSING_AMOUNTS", "Não existem valores verificáveis nesta linha.");
    if (net !== null && tax !== null && gross !== null && Math.abs(net + tax - gross) > 0.011) alert(alerts, row, "gross", "TOTAL_MISMATCH", "Base tributável + imposto divergem do total; não se aplicou desconto novamente.");
    if (net === null || tax === null || gross === null) alert(alerts, row, "amount", "PARTIAL_AMOUNTS", "Base, imposto ou total em falta; não foi inferido o valor ausente.", "warning");
    const reversesDocumentId = text(get("reversesDocumentId")) || null;
    if (kind === "credit_note" && !reversesDocumentId) alert(alerts, row, "reversesDocumentId", "MISSING_REVERSAL", "Nota de crédito sem referência ao documento original.");
    return { row, documentId, lineId, kind, reversesDocumentId, occurredOn, currency, net, tax, gross, discount, customer: text(get("customer")) || null, product: text(get("product")) || null };
  });
  const currencies = [...new Set(records.map((record) => record.currency).filter((currency): currency is string => Boolean(currency)))].sort();
  const byCurrency = Object.fromEntries(currencies.map((currency) => {
    const group = records.filter((record) => record.currency === currency);
    return [currency, { net: sum(group.map((r) => r.net)), tax: sum(group.map((r) => r.tax)), gross: sum(group.map((r) => r.gross)) }];
  }));
  let convertedRows = 0;
  const converted = records.map((record) => {
    let rate: number | null = record.currency === "MZN" ? 1 : null;
    if (record.currency && record.currency !== "MZN" && record.occurredOn) {
      const matches = rates.filter((r) => r.currency === record.currency && r.date === record.occurredOn && r.source.trim() && Number.isFinite(r.rateToMzn) && r.rateToMzn > 0);
      if (matches.length === 1) rate = matches[0].rateToMzn;
    }
    if (rate === null) alert(alerts, record.row, "currency", "MISSING_FX", "Conversão MZN indisponível: exige taxa positiva única, data do documento e fonte explícita.");
    else convertedRows++;
    return { net: rate !== null && record.net !== null ? record.net * rate : null, tax: rate !== null && record.tax !== null ? record.tax * rate : null, gross: rate !== null && record.gross !== null ? record.gross * rate : null };
  });
  const dates = records.map((record) => record.occurredOn).filter((date): date is string => Boolean(date)).sort();
  return {
    parserVersion: GIE_IMPORT_PARSER_VERSION, originalSha256: createHash("sha256").update(input).digest("hex"), sourceName: sourceName.slice(0, 255), sourceBytes: input.byteLength,
    records, alerts, exchangeRates: rates.map((rate) => ({ ...rate })), coverage: { rows: records.length, periodFrom: dates[0] ?? null, periodTo: dates.at(-1) ?? null, datedRows: dates.length, currencies },
    totals: { byCurrency, mzn: { net: sum(converted.map((r) => r.net)), tax: sum(converted.map((r) => r.tax)), gross: sum(converted.map((r) => r.gross)) }, convertedRows },
    limitations: ["Dados importados são declarações até revisão e aprovação humana.", "Um extracto de vendas não comprova recebimentos, lucro, nem cumprimento fiscal.", "Notas de crédito fora deste lote exigem reconciliação com o documento original.", "Base tributável é líquida dos descontos declarados; nenhum desconto foi aplicado novamente.", "Câmbio apenas com data do documento e fonte informadas; MZN é a moeda de apresentação.", "Valores convertidos são agregados antes do arredondamento final a duas casas decimais.", "A reconciliação com registos contabilísticos externos ainda exige evidência e revisão do gestor."],
  };
}
export function canTransitionImport(state: ImportState, target: ImportState, snapshot: Pick<GIEImportSnapshot, "alerts" | "records">, isManager: boolean, reason: string): boolean {
  if (!isManager || !reason.trim() || ["approved", "rejected"].includes(state)) return false;
  if (state === "received") return target === "in_review" || target === "rejected";
  return target === "rejected" || target === "approved" && snapshot.records.length > 0 && !snapshot.alerts.some((entry) => entry.severity === "error");
}

export type GIELedgerReference={sourceReference:string;periodFrom:string;periodTo:string;currency:"MZN";net:number|null;tax:number|null;gross:number|null};
export function reconcileGIE360Ledger(snapshot:Pick<GIEImportSnapshot,"coverage"|"totals">,reference:GIELedgerReference){
 const alerts:string[]=[];const differences:Partial<Record<"net"|"tax"|"gross",number>>={};const comparedFields:Array<"net"|"tax"|"gross">=[];
 if(reference.sourceReference.trim().length<3)alerts.push("Indique a fonte e referência do registo contabilístico.");
 if(reference.currency!=="MZN")alerts.push("A referência contabilística deve estar expressa em MZN.");
 if(!reference.periodFrom||!reference.periodTo||reference.periodFrom!==snapshot.coverage.periodFrom||reference.periodTo!==snapshot.coverage.periodTo)alerts.push("O período da referência deve coincidir exactamente com a cobertura do lote.");
 for(const field of ["net","tax","gross"] as const){
  const expected=reference[field];if(expected===null)continue;
  const actual=snapshot.totals.mzn[field];
  if(!Number.isFinite(expected)||actual===null){alerts.push(`Valor de referência ou valor importado indisponível: ${field}.`);continue;}
  comparedFields.push(field);differences[field]=Math.round((actual-expected)*100)/100;
 }
 if(!comparedFields.length)alerts.push("Indique pelo menos um total contabilístico comparável (base, imposto ou total).");
 const status=alerts.length?"missing_data":Object.values(differences).some(difference=>Math.abs(difference||0)>0.01)?"differences":"matched";
 return {status,reference,comparedFields,differences,alerts,limitation:"Reconciliação limitada aos totais e período indicados. A referência é declarada pelo gestor; não comprova lucro, recebimentos ou conformidade fiscal."};
}
export function parseImportExchangeRate(value:unknown):number|null{const raw=text(value);if(!/^\d+(?:[.,]\d{1,8})?$/.test(raw))return null;const n=Number(raw.replace(",","."));return Number.isFinite(n)&&n>0&&n<=1e9?n:null;}
