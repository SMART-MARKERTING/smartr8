// Email / phone / name normalization for inbound lead submissions.

export function normalizeEmail(raw: string | undefined): string {
  return String(raw || "").trim().toLowerCase();
}

/**
 * Convert a US phone number to E.164. Accepts:
 *   - 10-digit: "5555551234"           -> "+15555551234"
 *   - 11-digit with leading 1: "15555551234" -> "+15555551234"
 *   - already E.164: "+15555551234"    -> "+15555551234"
 *   - garbage: "abc" or empty          -> ""
 *
 * Returns "" if the input cannot be coerced into a valid US E.164 number.
 */
export function normalizePhoneE164US(raw: string | undefined): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";

  // Strip everything except digits and an optional leading +.
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  if (hasPlus) {
    // Already in E.164. Require + followed by 11+ digits.
    if (digits.length < 10 || digits.length > 15) return "";
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

/**
 * Trim names. If the input is entirely uppercase or entirely lowercase,
 * title-case it word-by-word. Leave mixed-case names alone (so "McDermott"
 * or "O'Brien" survive untouched).
 */
export function normalizeName(raw: string | undefined): string {
  const t = String(raw || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  const isAllUpper = t === t.toUpperCase() && /[A-Z]/.test(t);
  const isAllLower = t === t.toLowerCase() && /[a-z]/.test(t);
  if (!isAllUpper && !isAllLower) return t;
  return t
    .toLowerCase()
    .replace(/(^|\s|'|-)([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}
