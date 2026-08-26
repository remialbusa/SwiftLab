import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffSession } from '@/lib/staffSession';
import { isAdmin } from '@/lib/staffAuth';
import { getServiceClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';

const paramsSchema = z.object({ patientId: z.string().uuid() });

/**
 * DELETE /api/v1/admin/patients/:patientId
 * Permanently deletes a patient and all their data.
 * Because orders.patient_id has ON DELETE CASCADE, deleting the patient
 * removes their orders → order_tests, appointments, payments, results and
 * magic_links automatically. Result PDFs in storage are removed first so no
 * orphaned files remain.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ patientId: string }> }) {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const { patientId } = paramsSchema.parse(await params);
  const client = getServiceClient();

  // Load the patient so we can log who/what was removed.
  const { data: patient } = await client
    .from('patients')
    .select('id, full_name, last_name, email')
    .eq('id', patientId)
    .maybeSingle();
  if (!patient) {
    return NextResponse.json({ error: 'Patient not found.' }, { status: 404 });
  }

  // Collect storage paths for every result PDF across the patient's orders.
  const { data: orderRows } = await client
    .from('orders')
    .select('id')
    .eq('patient_id', patientId);
  const orderIds = (orderRows ?? []).map((o) => o.id as string);

  let resultPaths: { storage_path: string | null }[] = [];
  if (orderIds.length > 0) {
    const { data } = await client
      .from('results')
      .select('storage_path')
      .in('order_id', orderIds);
    resultPaths = data ?? [];
  }

  // Remove PDFs from storage first (best-effort; DB rows cascade away).
  const paths = resultPaths
    .map((r) => r.storage_path)
    .filter((p): p is string => Boolean(p));
  if (paths.length > 0) {
    await client.storage.from('patient-pdfs').remove(paths);
  }

  const { error } = await client.from('patients').delete().eq('id', patientId);
  if (error) {
    return NextResponse.json({ error: 'Could not delete patient.' }, { status: 500 });
  }

  await writeAuditLog({
    actorType: 'staff',
    actorId: session.identity.id,
    action: 'patients.deleted',
    resourceType: 'patient',
    resourceId: patientId,
    metadata: { email: patient.email, name: `${patient.full_name} ${patient.last_name}`.trim(), storageFiles: paths.length },
  });

  return NextResponse.json({ ok: true });
}