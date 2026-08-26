/**
 * PDF encryption using the `qpdf` binary via `node-qpdf2`.
 *
 * `node-qpdf2` shells out to a `qpdf` executable on PATH. This module ensures
 * the binary can be resolved across runtimes:
 *  - Windows local dev: uses the winget default install location
 *    (`C:\Program Files\qpdf 12.4.0\bin`) or `QPDF_PATH`.
 *  - Linux serverless (Vercel): uses the bundled Linux binary + shared libs
 *    committed at `bin/qpdf-linux/`. `LD_LIBRARY_PATH` is pointed at the
 *    bundled libs so the binary runs without system deps.
 */

import { encrypt } from 'node-qpdf2';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Default install location of the qpdf binary on Windows via winget. */
const WINDOWS_DEFAULT_QPDF = join(
  process.env.PROGRAMFILES ?? 'C:\\Program Files',
  'qpdf 12.4.0',
  'bin',
);

/** Committed Linux build (qpdf + shared libs) for serverless runtimes. */
const LINUX_QPDF_BIN = join(process.cwd(), 'bin', 'qpdf-linux', 'bin');
const LINUX_QPDF_LIB = join(process.cwd(), 'bin', 'qpdf-linux', 'lib');

/**
 * Resolve the qpdf binary directory and amend PATH (and LD_LIBRARY_PATH on
 * Linux) so `node-qpdf2` (which spawns `qpdf`) finds it. Honors `QPDF_PATH`
 * first, then the platform default.
 */
function ensureQpdfOnPath(): string {
  const explicit = process.env.QPDF_PATH;
  if (explicit) {
    return explicit;
  }

  if (process.platform === 'win32') {
    const candidate = WINDOWS_DEFAULT_QPDF;
    if (!process.env.PATH?.split(';').includes(candidate)) {
      process.env.PATH = `${candidate};${process.env.PATH ?? ''}`;
    }
    return candidate;
  }

  // Linux / serverless: bundled binary + its libs.
  if (existsSync(join(LINUX_QPDF_BIN, 'qpdf'))) {
    if (!process.env.PATH?.split(':').includes(LINUX_QPDF_BIN)) {
      process.env.PATH = `${LINUX_QPDF_BIN}:${process.env.PATH ?? ''}`;
    }
    if (!process.env.LD_LIBRARY_PATH?.split(':').includes(LINUX_QPDF_LIB)) {
      process.env.LD_LIBRARY_PATH = `${LINUX_QPDF_LIB}:${process.env.LD_LIBRARY_PATH ?? ''}`;
    }
    return LINUX_QPDF_BIN;
  }

  return LINUX_QPDF_BIN; // fall back; spawn will fail with a clear error
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