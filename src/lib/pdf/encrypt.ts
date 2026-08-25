/**
 * PDF encryption using the `qpdf` binary via `node-qpdf2`.
 *
 * `node-qpdf2` shells out to a `qpdf` executable on PATH. This module ensures
 * the binary can be resolved, locating it either from the `QPDF_PATH`
 * environment variable or from a known default Windows install location, then
 * encrypts an in-memory PDF with the patient-derived password.
 */

import { encrypt } from 'node-qpdf2';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Default install location of the qpdf binary on Windows via winget. */
const WINDOWS_DEFAULT_QPDF = join(
  process.env.PROGRAMFILES ?? 'C:\\Program Files',
  'qpdf 12.4.0',
  'bin',
);

/**
 * Resolve the qpdf binary path and add its directory to `PATH` for the current
 * process so that `node-qpdf2` (which spawns `qpdf`) finds it. Honors the
 * `QPDF_PATH` env var first.
 */
function ensureQpdfOnPath(): string {
  const explicit = process.env.QPDF_PATH;
  if (explicit) {
    return explicit;
  }
  const candidate = WINDOWS_DEFAULT_QPDF;
  const hasDirectory = candidate;
  // Only amend PATH once.
  if (hasDirectory && !process.env.PATH?.split(';').includes(candidate)) {
    process.env.PATH = `${candidate};${process.env.PATH ?? ''}`;
  }
  return candidate;
}

export interface EncryptPdfOptions {
  /** Raw PDF bytes (already read into a Buffer). */
  pdf: Buffer;
  /** Password to encrypt the PDF with. */
  password: string;
}

export interface EncryptedPdf {
  /** Encrypted PDF bytes, safe to persist / attach. */
  data: Buffer;
}

/**
 * Encrypt a PDF buffer with the given password (AES-128, non-printing
 * restrictions off so the patient retains copy/print rights).
 *
 * @param options - the raw PDF bytes and the password.
 * @returns the encrypted PDF bytes.
 * @throws if the PDF is empty or encryption fails.
 */
export async function encryptPdf(options: EncryptPdfOptions): Promise<EncryptedPdf> {
  if (options.pdf.length === 0) {
    throw new Error('Cannot encrypt an empty PDF buffer.');
  }
  ensureQpdfOnPath();

  const workDir = await mkdtemp(join(tmpdir(), 'swiftlab-pdf-'));
  const inputPath = join(workDir, 'input.pdf');
  const outputPath = join(workDir, 'output.pdf');
  try {
    await writeFile(inputPath, options.pdf);
    await encrypt({
      input: inputPath,
      output: outputPath,
      password: options.password,
      keyLength: 128,
      restrictions: {
        useAes: 'y',
        // Let the patient print and copy their own results.
        print: 'full',
        modify: 'none',
        extract: 'y',
      },
    });
    const encrypted = await readFile(outputPath);
    return { data: encrypted };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}