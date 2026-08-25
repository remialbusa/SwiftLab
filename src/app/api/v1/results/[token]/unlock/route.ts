import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase/server';
import { hashToken } from '@/lib/token';
import { derivePdfPassword } from '@/lib/pdf/password';
import { writeAuditLog } from '@/lib/audit';
import { getSettings } from '@/lib/settings';
import { checkRateLimit } from '@/lib/rateLimit';

const paramsSchema = z.object({ token: z.string().min(1) });
const bodySchema = z.object({
  lastName: z.string().min(1),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const SIGNED_URL_EXPIRY_SECONDS = 60 * 15; // 15 minutes

/**
 * POST /api/v1/results/:token/unlock
 * Validates the results magic link, verifies the patient's last name + birth
 * date (unlimited attempts — the PDF remains password-protected regardless),
 * and returns short-lived signed URLs for the encrypted PDFs.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = paramsSchema.parse(await params);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }, { status: 400 });
  }

  // Rate-limit by IP before doing any work. The window/max come from admin
  // settings. Only failed attempts consume quota.
  const settings = await getSettings();
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = checkRateLimit(
    `unlock:${ip}`,
    settings.resultsUnlockMaxAttempts,
    settings.resultsUnlockWindowMinutes,
    false,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const client = getServiceClient();
  const { data: link } = await client
    .from('magic_links')
    .select('order_id, purpose, expires_at, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (!link || link.purpose !== 'results') {
    return NextResponse.json({ error: 'This results link is invalid.' }, { status: 404 });
  }
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'This results link has expired.' }, { status: 410 });
  }
  if (link.revoked_at) {
    return NextResponse.json({ error: 'This results link was revoked.' }, { status: 410 });
  }

  const { data: order } = await client
    .from('orders')
    .select('id, status, patients(last_name, dob)')
    .eq('id', link.order_id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }
  const patient = order.patients as { last_name?: string; dob?: string } | null;
  if (!patient?.last_name || !patient?.dob) {
    return NextResponse.json({ error: 'Patient details are incomplete.' }, { status: 422 });
  }

  // Verify identity — unlimited attempts (no rate limit by design). Compare
  // against the same normalization used when the PDF was encrypted.
  const expected = derivePdfPassword({ lastName: patient.last_name, birthDate: patient.dob });
  const candidate = derivePdfPassword({ lastName: parsed.data.lastName, birthDate: parsed.data.dob });
  if (candidate !== expected) {
    checkRateLimit(
      `unlock:${ip}`,
      settings.resultsUnlockMaxAttempts,
      settings.resultsUnlockWindowMinutes,
      true,
    );
    await writeAuditLog({
      actorType: 'patient',
      action: 'results.unlock_failed',
      resourceType: 'order',
      resourceId: order.id,
    });
    return NextResponse.json({ error: 'Last name or birth date did not match.' }, { status: 401 });
  }

  // Load results + mint signed URLs.
  const { data: results } = await client
    .from('results')
    .select('id, storage_path, file_name, file_size, uploaded_at')
    .eq('order_id', order.id)
    .order('uploaded_at', { ascending: true });

  if (!results || results.length === 0) {
    return NextResponse.json({ error: 'No results are available for this order.' }, { status: 404 });
  }

  const files: { id: string; fileName: string; size: number; uploadedAt: string; signedUrl: string }[] = [];
  for (const result of results) {
    const { data: signed } = await client.storage
      .from('patient-pdfs')
      .createSignedUrl(result.storage_path as string, SIGNED_URL_EXPIRY_SECONDS, {
        download: result.file_name as string,
      });
    if (signed?.signedUrl) {
      files.push({
        id: result.id as string,
        fileName: result.file_name as string,
        size: result.file_size as number,
        uploadedAt: result.uploaded_at as string,
        signedUrl: signed.signedUrl,
      });
    }
  }

  await writeAuditLog({
    actorType: 'patient',
    action: 'results.accessed',
    resourceType: 'order',
    resourceId: order.id,
    metadata: { fileCount: files.length },
  });

  return NextResponse.json({ files });
}