import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffSession } from '@/lib/staffSession';
import { getServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';
import { encryptPdf } from '@/lib/pdf/encrypt';
import { derivePdfPassword } from '@/lib/pdf/password';

const paramsSchema = z.object({ orderId: z.string().uuid() });

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/v1/staff/orders/:orderId/results
 * MedTech uploads a PDF result. The file is:
 *   1. validated (PDF magic bytes + size cap),
 *   2. encrypted with the patient's derived password (AES-128),
 *   3. stored in the private `patient-pdfs` bucket under pdfs/{orderId}/,
 *   4. logged in the results table + audit trail.
 * Multiple PDFs per order are allowed.
 */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { orderId } = paramsSchema.parse(await params);
  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A PDF file is required (field "file").' }, { status: 400 });
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File must be a PDF under 10 MB.' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are allowed.' }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // Validate PDF magic bytes (%PDF-).
  if (bytes.length < 5 || bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return NextResponse.json({ error: 'The uploaded file is not a valid PDF.' }, { status: 400 });
  }

  const client = getServiceClient();
  // Load patient + existing order to derive the password.
  const { data: order } = await client
    .from('orders')
    .select('id, status, patients(last_name, dob)')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }
  const patient = order.patients as { last_name?: string; dob?: string } | null;
  if (!patient?.last_name || !patient?.dob) {
    return NextResponse.json({ error: 'Patient data is incomplete for PDF encryption.' }, { status: 422 });
  }

  const password = derivePdfPassword({ lastName: patient.last_name, birthDate: patient.dob });

  let encrypted: Buffer;
  try {
    const result = await encryptPdf({ pdf: bytes, password });
    encrypted = result.data;
  } catch {
    return NextResponse.json({ error: 'Could not encrypt the PDF.' }, { status: 500 });
  }

  const storagePath = `pdfs/${orderId}/${crypto.randomUUID()}.pdf`;
  const { error: uploadErr } = await client.storage
    .from('patient-pdfs')
    .upload(storagePath, encrypted, { contentType: 'application/pdf', upsert: false });
  if (uploadErr) {
    return NextResponse.json({ error: 'Could not store the PDF.' }, { status: 500 });
  }

  const { data: resultRow, error: insertErr } = await client
    .from('results')
    .insert({
      order_id: orderId,
      storage_path: storagePath,
      file_name: file.name,
      file_size: encrypted.length,
      uploaded_by: session.identity.id,
      released_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (insertErr || !resultRow) {
    // Roll back the uploaded file so we don't leave orphans.
    await client.storage.from('patient-pdfs').remove([storagePath]);
    return NextResponse.json({ error: 'Could not record the result.' }, { status: 500 });
  }

  await writeAuditLog({
    actorType: 'staff',
    actorId: session.identity.id,
    action: 'results.uploaded',
    resourceType: 'order',
    resourceId: orderId,
    metadata: { file: file.name, size: encrypted.length },
  });

  return NextResponse.json({ ok: true, resultId: resultRow.id }, { status: 201 });
}