import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import type { SourceRow } from "./normalize";

const aliases: Record<string, string> = {
  e_mail: "email",
  mobile: "phone",
  pays: "country",
};
export type ParsedRow = {
  row: SourceRow;
  line: number;
  columnMismatch: boolean;
};
export function parseExport(
  buffer: Buffer,
  delimiter: "," | ";",
): { encoding: string; rows: ParsedRow[] } {
  let encoding = "UTF-8";
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    encoding = "Windows-1252";
    source = iconv.decode(buffer, "windows-1252");
  }
  // csv-parse's array overload does not model the info/raw envelope.
  const records = parse(source, {
    delimiter,
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    info: true,
    raw: true,
  }) as unknown as { record: string[]; info: { lines: number }; raw: string }[];
  if (records.length < 1) throw new Error("The export is empty.");
  const headers = records[0].record.map((value) => {
    const key = value.trim().toLowerCase().replace(/\s+/g, "_");
    return aliases[key] ?? key;
  });
  if (new Set(headers).size !== headers.length)
    throw new Error("The export contains duplicate column names.");
  return {
    encoding,
    rows: records.slice(1).map(({ record, info, raw }) => ({
      row: Object.fromEntries(
        headers.map((key, index) => [key, record[index] ?? ""]),
      ),
      line:
        info.lines -
        (raw.match(/\n/g)?.length ?? 0) +
        (raw.endsWith("\n") ? 1 : 0),
      columnMismatch: record.length !== headers.length,
    })),
  };
}
