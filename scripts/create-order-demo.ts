/**
 * Demo: register a lab order through the public API end-to-end.
 *
 * Creates an order (patient + tracking magic link) via POST /api/v1/orders,
 * then simulates a patient viewing the tracking page. Prints the tracking
 * link to open in a browser.
 *
 * Run:
 *   node --import tsx scripts/create-order-demo.ts [email]
 *
 * Requires the dev server to be running (APP_URL, default http://localhost:3000).
 */

const base = process.env.APP_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
const email = process.argv[2] ?? 'demo.patient@example.com';

async function main(): Promise<void> {
  // Fetch active tests to pick one.
  const testsRes = await fetch(`${base}/api/v1/lab-tests`);
  if (!testsRes.ok) {
    console.error(`Could not load tests (${testsRes.status}) — is the dev server running?`);
    process.exit(1);
  }
  const { tests } = (await testsRes.json()) as { tests: { id: string; name: string }[] };
  if (!tests.length) {
    console.error('No active lab tests. Seed them or check the migration.');
    process.exit(1);
  }
  const test = tests[0];
  console.log(`Using test: ${test.name}`);

  const orderRes = await fetch(`${base}/api/v1/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Demo Patient',
      lastName: 'Patient',
      dob: '1990-05-14',
      email,
      phone: '+63 912 345 6789',
      testIds: [test.id],
      privacyConsent: true,
    }),
  });
  const orderJson = (await orderRes.json()) as {
    ok?: boolean;
    error?: string;
    trackingToken?: string;
    trackingCode?: string;
  };

  if (!orderRes.ok || !orderJson.ok || !orderJson.trackingToken) {
    console.error(`Order creation failed: ${orderJson.error ?? orderRes.status}`);
    process.exit(1);
  }

  const trackUrl = `${base}/track/${orderJson.trackingToken}`;
  console.log('\n=== Order registered ===');
  console.log(`Email: ${email}`);
  console.log(`Tracking code: ${orderJson.trackingCode ?? 'n/a'}`);
  console.log(`Tracking link:\n  ${trackUrl}`);
  console.log('\nEnter the tracking code at /track or open the link to view status.');
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});