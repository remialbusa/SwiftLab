/**
 * PDF password derivation and normalization.
 *
 * The patient-facing PDF password is derived from the patient's last name and
 * birth date. The same derivation must be applied when the PDF is encrypted
 * (server-side) so a consistent string is produced in both paths.
 *
 * Format: `{lastName}{MMDDYYYY}` — e.g. Dela Cruz, born 1990-05-14 →
 * `delacruz05141990`. No dashes or special characters: the birth date is
 * joined as month + day + year without separators, and the name is
 * lowercased with all non-alphanumeric characters stripped.
 */

const DATE_PATTERN = /^\d{8}$/;

/** Normalize a single name token for use inside a PDF password. */
function normalizeNameToken(value: string): string {
  return value
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

/** Normalize a birth date into `MMDDYYYY` (no separators) for the password. */
function normalizeBirthDate(value: string): string {
  const trimmed = value.trim();
  // Accept `YYYY-MM-DD`, `MM/DD/YYYY`, `MM-DD-YYYY`, `YYYY/MM/DD`.
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[2]}${isoMatch[3]}${isoMatch[1]}`;
  }
  const usMatch = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (usMatch) {
    return `${usMatch[1]}${usMatch[2]}${usMatch[3]}`;
  }
  return trimmed.replace(/[^0-9]/g, '');
}

export interface PdfPasswordInput {
  /** Patient's last name / surname. */
  lastName: string;
  /** Patient's birth date, in `YYYY-MM-DD` (or a supported alternate form). */
  birthDate: string;
}

/**
 * Derive the normalized PDF open-password for a patient.
 *
 * @param input - last name and birth date.
 * @returns the normalized password string used to encrypt and open the PDF.
 * @throws if the birth date is not a recognized date format.
 */
export function derivePdfPassword(input: PdfPasswordInput): string {
  const date = normalizeBirthDate(input.birthDate);
  if (date.length !== 8 || !/^\d{8}$/.test(date)) {
    throw new Error(
      `Invalid birth date format: "${input.birthDate}". Expected YYYY-MM-DD.`,
    );
  }
  return `${normalizeNameToken(input.lastName)}${date}`;
}

/**
 * Validate an end-user supplied password against the expected derived one.
 * Comparison is done on the normalized form only (case/format-insensitive),
 * so a patient typing "Dela Cruz 1990-05-14" still opens their PDF.
 */
export function isPdfPasswordValid(candidate: string, expected: PdfPasswordInput): boolean {
  const normalized = candidate.replace(/\s+/g, '').toLowerCase();
  return normalized === derivePdfPassword(expected);
}