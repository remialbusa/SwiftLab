/**
 * Dev bootstrap: apply all migrations + seed data, then create a staff user.
 *
 * This wraps the two things a fresh environment needs:
 *   1. `supabase db push` (or `supabase migration up`) — applies migrations.
 *   2. `tsx scripts/seed-staff.ts` — creates auth user + staff_users row.
 *
 * Run from the repo root:
 *   node --import tsx scripts/bootstrap-dev-db.ts
 *
 * Requires:
 *   - Supabase CLI installed (`supabase --version`)
 *   - A linked/local Supabase project (migrations are applied there)
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function run(cmd: string): void {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

function main(): void {
  // Guard: the migrations exist.
  const migrationsDir = join(root, "supabase", "migrations");
  if (!existsSync(migrationsDir)) {
    console.error("supabase/migrations not found — run from the repo root.");
    process.exit(1);
  }

  console.log("=== SwiftLab dev DB bootstrap ===");

  // 1. Apply schema/functions/seed via the Supabase CLI.
  try {
    run("supabase db push");
  } catch {
    console.log("Trying `supabase migration up` instead...");
    run("supabase migration up");
  }

  // 2. Create the admin + a medtech staff user.
  console.log("\n=== Seeding staff users ===");
  run("node --import tsx scripts/seed-staff.ts admin@swiftlab.local SwiftLab#2026 admin");
  run("node --import tsx scripts/seed-staff.ts medtech@swiftlab.local SwiftLab#2026 medtech");

  console.log("\n=== Done ===");
  console.log("Staff logins:");
  console.log("  admin@swiftlab.local / SwiftLab#2026  (admin)");
  console.log("  medtech@swiftlab.local / SwiftLab#2026 (medtech)");
  console.log("\nNext: npm run dev  →  http://localhost:3000/staff/login");
}

main();
