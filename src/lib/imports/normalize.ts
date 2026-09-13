import {
  getCountries,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { z } from "zod";

export type Issue = {
  code: string;
  message: string;
  severity: "warning" | "error";
};
export type SourceRow = Record<string, string>;
export type ContactRecord = {
  external_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  signup_at: string | null;
  status: "active" | "pending" | "unsubscribed" | "bounced";
  consent_marketing: boolean;
  deleted_at: string | null;
  suppressed_until: string | null;
};
export class InvalidRow extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function validateText(row: SourceRow) {
  if (
    Object.values(row).some((value) =>
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value),
    )
  ) {
    throw new InvalidRow(
      "invalid_control_character",
      "Row contains an unsupported control character. It is shown escaped in the original row.",
    );
  }
}
const countries = new Set<string>(getCountries());
const countryAliases: Record<string, string> = {
  KEN: "KE",
  KENYA: "KE",
  "254": "KE",
  ZAF: "ZA",
  "SOUTH AFRICA": "ZA",
  MAR: "MA",
  MOROCCO: "MA",
  MAROC: "MA",
};
const emptyValues = new Set(["", "null", "none", "n/a", "na", "undefined"]);
export const clean = (value: string | undefined) => (value ?? "").trim();
export const absent = (value: string | undefined) =>
  emptyValues.has(clean(value).toLowerCase());

export function country(value: string | undefined): string | null {
  const normalized = clean(value).toUpperCase();
  return (
    countryAliases[normalized] ??
    (countries.has(normalized) ? normalized : null)
  );
}
export function date(
  value: string | undefined,
  field: string,
  issues: Issue[],
  required = false,
): string | null {
  const v = clean(value);
  if (absent(v)) {
    if (required) throw new InvalidRow("missing_date", `${field} is required.`);
    return null;
  }
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(
      v,
    );
  const dateOnly = v.length === 10;
  const parsed = new Date(dateOnly ? `${v}T00:00:00Z` : v);
  if (
    !match ||
    !Number.isFinite(parsed.getTime()) ||
    Number(match[2]) < 1 ||
    Number(match[2]) > 12 ||
    Number(match[3]) < 1 ||
    Number(match[3]) >
      new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate()
  ) {
    throw new InvalidRow(
      "invalid_date",
      `${field} must be a real ISO date with an explicit timezone (or a date only).`,
    );
  }
  if (dateOnly)
    issues.push({
      code: `${field}_date_only`,
      message: `${field} has no time; counted at 00:00 UTC on that date.`,
      severity: "warning",
    });
  return dateOnly ? parsed.toISOString() : v;
}
export function integer(value: string | undefined, field: string): number {
  const v = clean(value);
  if (
    !/^\d+$/.test(v) ||
    !Number.isSafeInteger(Number(v)) ||
    Number(v) > 2147483647
  )
    throw new InvalidRow(
      "invalid_number",
      `${field} must be a nonnegative integer.`,
    );
  return Number(v);
}
export function minorUnits(value: string | undefined): number {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(clean(value));
  if (!match)
    throw new InvalidRow(
      "invalid_spend",
      "Spend must be a nonnegative amount with at most two decimal places.",
    );
  const amount =
    Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(amount))
    throw new InvalidRow(
      "invalid_spend",
      "Spend is outside the supported range.",
    );
  return amount;
}
export function identifier(
  value: string | undefined,
  field = "external_id",
): string {
  const v = clean(value);
  if (
    !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(v) ||
    v.toLowerCase() === field.toLowerCase()
  )
    throw new InvalidRow(
      "invalid_identifier",
      `${field} is missing or invalid (possibly a repeated header).`,
    );
  return v;
}
export function normalizeContact(
  row: SourceRow,
  brandCode: string,
): { record: ContactRecord; issues: Issue[] } {
  validateText(row);
  const issues: Issue[] = [];
  const warn = (code: string, message: string) =>
    issues.push({ code, message, severity: "warning" });
  if (clean(row.brand_code).toUpperCase() !== brandCode)
    throw new InvalidRow(
      "brand_mismatch",
      `Brand field does not match this ${brandCode} export.`,
    );
  const external_id = identifier(row.external_id);
  const full_name = clean(row.full_name);
  if (!full_name || full_name.length > 200)
    throw new InvalidRow(
      "invalid_name",
      "Name must be between 1 and 200 characters.",
    );
  const normalizedCountry = country(row.country);
  if (!normalizedCountry)
    warn(
      "unknown_country",
      "Country is unknown; not inferred from the brand or phone.",
    );
  const rawEmail = clean(row.email).toLowerCase();
  const email =
    !absent(rawEmail) &&
    rawEmail.length <= 254 &&
    z.email().safeParse(rawEmail).success
      ? rawEmail
      : null;
  if (!email)
    warn(
      "unusable_email",
      "No valid email destination; excluded from email sends.",
    );
  const rawPhone = clean(row.phone);
  const digits = rawPhone.replace(/\D/g, "");
  const international =
    rawPhone.startsWith("+") ||
    /^(254|212|27|256|250|255|251|211)\d{8,9}$/.test(digits);
  const parsedPhone = absent(rawPhone)
    ? undefined
    : parsePhoneNumberFromString(
        international ? `+${digits}` : rawPhone,
        normalizedCountry as CountryCode | undefined,
      );
  const phone = parsedPhone?.isValid() ? parsedPhone.number : null;
  if (!phone)
    warn(
      "unusable_phone",
      "No unambiguous valid phone destination; excluded from SMS sends.",
    );
  const statusText = clean(row.status).toLowerCase();
  const status = statusText === "unsubscribe" ? "unsubscribed" : statusText;
  if (!["active", "pending", "unsubscribed", "bounced"].includes(status))
    throw new InvalidRow(
      "invalid_status",
      "Status must be active, pending, unsubscribed or bounced.",
    );
  const consent = clean(row.consent_marketing).toLowerCase();
  const consent_marketing = ["true", "1", "yes", "y"].includes(consent);
  if (
    !["true", "1", "yes", "y", "false", "0", "no", "n", "f"].includes(consent)
  )
    warn(
      "unknown_consent",
      "Marketing consent is unknown; treated as no permission.",
    );
  let signup_at: string | null = null;
  try {
    signup_at = date(row.signup_at, "signup_at", issues);
  } catch (error) {
    if (!(error instanceof InvalidRow)) throw error;
    warn(
      "invalid_signup",
      "Signup date is invalid; excluded from the daily signup chart.",
    );
  }
  if (!signup_at)
    warn(
      "missing_signup",
      "No reliable signup date; excluded from the daily signup chart.",
    );
  return {
    record: {
      external_id,
      full_name,
      email,
      phone,
      country: normalizedCountry,
      city: clean(row.city) || null,
      signup_at,
      status: status as ContactRecord["status"],
      consent_marketing,
      deleted_at: date(row.deleted_at, "deleted_at", issues),
      suppressed_until: date(row.suppressed_until, "suppressed_until", issues),
    },
    issues,
  };
}

export function mergeDuplicateContact(
  first: ContactRecord,
  last: ContactRecord,
): ContactRecord {
  const rank = { active: 0, pending: 1, bounced: 2, unsubscribed: 3 };
  return {
    ...last,
    consent_marketing: first.consent_marketing && last.consent_marketing,
    status: rank[first.status] > rank[last.status] ? first.status : last.status,
    deleted_at: first.deleted_at ?? last.deleted_at,
    suppressed_until:
      [first.suppressed_until, last.suppressed_until]
        .filter((v): v is string => v !== null)
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null,
  };
}
