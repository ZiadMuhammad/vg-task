import { describe, expect, it } from "vitest";
import iconv from "iconv-lite";
import { parseExport } from "@/lib/imports/csv";
import {
  date,
  InvalidRow,
  mergeDuplicateContact,
  minorUnits,
  normalizeContact,
} from "@/lib/imports/normalize";

const contact = {
  external_id: "CT-001",
  full_name: "Amina Test",
  email: " AMINA@EXAMPLE.TEST ",
  phone: "+254 712 345 678",
  country: "Kenya",
  city: "Nairobi",
  signup_at: "2026-09-01",
  status: "Active",
  consent_marketing: "Y",
  deleted_at: "",
  suppressed_until: "",
  brand_code: "KILELE",
};
describe("source adapters and conservative contactability", () => {
  it("normalizes known formats and explicitly labels date-only values", () => {
    const { record, issues } = normalizeContact(contact, "KILELE");
    expect(record).toMatchObject({
      email: "amina@example.test",
      phone: "+254712345678",
      country: "KE",
      status: "active",
      consent_marketing: true,
      signup_at: "2026-09-01T00:00:00.000Z",
    });
    expect(issues.map((issue) => issue.code)).toContain("signup_at_date_only");
  });
  it("rejects a cross-brand row instead of importing it into another brand", () => {
    expect(() =>
      normalizeContact({ ...contact, brand_code: "KAROO" }, "KILELE"),
    ).toThrow("does not match");
  });
  it("retains a customer with bad destinations but grants no contact permission", () => {
    const result = normalizeContact(
      {
        ...contact,
        email: "not-an-email",
        phone: "025701347763",
        country: "ZZ",
        consent_marketing: "maybe",
      },
      "KILELE",
    );
    expect(result.record).toMatchObject({
      email: null,
      phone: null,
      country: null,
      consent_marketing: false,
    });
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unknown_country",
        "unknown_consent",
        "unusable_email",
        "unusable_phone",
      ]),
    );
  });
  it("rejects an invalid suppression date instead of clearing suppression", () => {
    expect(() =>
      normalizeContact({ ...contact, suppressed_until: "tomorrow" }, "KILELE"),
    ).toThrow(InvalidRow);
  });
  it("rejects embedded NUL before a batch reaches Postgres", () => {
    expect(() =>
      normalizeContact({ ...contact, full_name: "Nul\u0000Byte" }, "KILELE"),
    ).toThrow("control character");
  });
  it("rejects impossible and ambiguous dates", () => {
    expect(() => date("2026-02-30", "test", [])).toThrow(InvalidRow);
    expect(() => date("03/04/2026", "test", [])).toThrow(InvalidRow);
    expect(() => date("2026-03-04T12:30:00", "test", [])).toThrow(InvalidRow);
  });
  it("does not restore permission when a duplicated row is less restrictive", () => {
    const base = normalizeContact(contact, "KILELE").record;
    const suppressed = {
      ...base,
      status: "unsubscribed" as const,
      consent_marketing: false,
      suppressed_until: "2027-01-01T00:00:00Z",
    };
    expect(mergeDuplicateContact(suppressed, base)).toMatchObject({
      status: "unsubscribed",
      consent_marketing: false,
      suppressed_until: "2027-01-01T00:00:00Z",
    });
    expect(mergeDuplicateContact(base, suppressed)).toEqual(
      mergeDuplicateContact(suppressed, base),
    );
  });
  it("parses decimal-comma spending without binary rounding", () => {
    expect(minorUnits("221,09")).toBe(22109);
    expect(minorUnits("0.29")).toBe(29);
    expect(() => minorUnits("221,091")).toThrow(InvalidRow);
  });
  it("handles CP1252, reordered headers, multiline fields and malformed rows", () => {
    const csv = iconv.encode(
      'Full Name,Email,External Id\r\n"Amina –\nTest",a@example.test,CT-1\r\nBroken,CT-2\r\n',
      "windows-1252",
    );
    const result = parseExport(csv, ",");
    expect(result.encoding).toBe("Windows-1252");
    expect(result.rows[0]).toEqual({
      row: {
        full_name: "Amina –\nTest",
        email: "a@example.test",
        external_id: "CT-1",
      },
      line: 2,
      columnMismatch: false,
    });
    expect(result.rows[1].columnMismatch).toBe(true);
    expect(result.rows[1].line).toBe(4);
  });
  it("maps the Morocco dialect explicitly", () => {
    expect(
      parseExport(
        Buffer.from(
          "external_id;e_mail;mobile;pays\nCT-1;a@example.test;+212653959127;MA\n",
        ),
        ";",
      ).rows[0].row,
    ).toEqual({
      external_id: "CT-1",
      email: "a@example.test",
      phone: "+212653959127",
      country: "MA",
    });
  });
});
