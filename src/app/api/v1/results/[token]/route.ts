import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase/server';
import { hashToken } from '@/lib/token';
import { writeAuditLog } from '@/lib/audit';

const paramsSchema = z.object({ token: z.string().min(1) });

const SIGNED_URL_EXPIRY_SECONDS = 60 * 15; // 15 minutes

/**
 * GET /api/v1/results/:token
 * Direct results access via the results magic link — no password prompt.
 *
 * Authorization is the (hashed, expiring, results-scoped) magic link itself.
 * Returns short-lived signed URLs for the encrypted PDFs. The PDF files
 * themselves remain password-protected with the patient's derived password.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = paramsSchema.parse(await params);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

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
    .select('id')
    .eq('id', link.order_id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

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

  void writeAuditLog({
    actorType: 'patient',
    action: 'results.accessed',
    resourceType: 'order',
    resourceId: order.id,
    metadata: { fileCount: files.length, ip },
  });

  return NextResponse.json({ files });
}