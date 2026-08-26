/**
 * Dev helper: test the staff PDF upload endpoint from the CLI.
 * Logs in as staff, uploads a minimal valid PDF as a result for an order.
 *
 * Usage: node --import tsx scripts/test-upload.ts <orderId> [email] [password]
 */

import { makeMinimalPdf } from './pdf-fixture';

const base = process.env.APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

async function main(): Promise<void> {
  const orderId = process.argv[2];
  if (!orderId) {
    console.error('Usage: node --import tsx scripts/test-upload.ts <orderId> [email] [password]');
    process.exit(1);
  }
  const email = process.argv[3] ?? 'admin@swiftlab.local';
  const password = process.argv[4] ?? 'SwiftLab#2026';

  const login = await fetch(`${base}/api/v1/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (login.status !== 200) {
    console.error('Login failed:', login.status, await login.text());
    process.exit(1);
  }
  const cookie = login.headers.get('set-cookie')?.split(';')[0] ?? '';
  console.log('Logged in as', email);

  const fd = new FormData();
  const pdfBytes = new Uint8Array(makeMinimalPdf());
  fd.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'test-result.pdf');
  const up = await fetch(`${base}/api/v1/staff/orders/${orderId}/results`, {
    method: 'POST',
    body: fd,
    headers: { cookie },
  });
  console.log('Upload status:', up.status);
  console.log(await up.text());
}

void main();