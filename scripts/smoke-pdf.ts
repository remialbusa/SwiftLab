/**
 * Smoke test for the PDF encryption path (dev-only, run via tsx).
 * Creates a minimal valid PDF, encrypts it, then verifies:
 *  1. decrypt with correct password works
 *  2. decrypt with wrong password fails
 * Run: node --import tsx scripts/smoke-pdf.ts
 */
import { decrypt } from 'node-qpdf2';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encryptPdf } from '../src/lib/pdf/encrypt';
import { derivePdfPassword, isPdfPasswordValid } from '../src/lib/pdf/password';
import { makeMinimalPdf } from './pdf-fixture';

async function main(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'swiftlab-smoke-'));
  const encryptedPath = join(dir, 'encrypted.pdf');
  try {
    const password = derivePdfPassword({ lastName: 'Dela Cruz', birthDate: '1990-05-14' });
    console.log('Derived password:', password);
    console.log('Password valid (correct):', isPdfPasswordValid(password, { lastName: 'Dela Cruz', birthDate: '1990-05-14' }));
    console.log('Password valid (wrong):', isPdfPasswordValid('wrongpassword', { lastName: 'Dela Cruz', birthDate: '1990-05-14' }));

    const encrypted = await encryptPdf({ pdf: makeMinimalPdf(), password });
    await writeFile(encryptedPath, encrypted.data);
    console.log('Encrypted PDF bytes:', encrypted.data.length);

    // Decrypt with correct password -> should succeed.
    const outCorrect = join(dir, 'out-correct.pdf');
    await decrypt({
      input: encryptedPath,
      output: outCorrect,
      password,
      keyLength: 128,
      restrictions: { extract: 'y' },
    });
    const decrypted = await readFile(outCorrect);
    console.log('Decrypt with correct password OK:', decrypted.length > 0);

    // Decrypt with wrong password -> should fail.
    const outWrong = join(dir, 'out-wrong.pdf');
    let failed = false;
    try {
      await decrypt({
        input: encryptedPath,
        output: outWrong,
        password: 'not-the-password',
        keyLength: 128,
        restrictions: { extract: 'y' },
      });
    } catch {
      failed = true;
    }
    console.log('Decrypt with wrong password rejected:', failed);

    if (decrypted.length === 0 || !failed) {
      throw new Error('Smoke test failed.');
    }
    console.log('PDF encryption smoke test PASSED.');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('Smoke test FAILED:', err);
  process.exit(1);
});