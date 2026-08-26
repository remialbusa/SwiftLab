import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffSession } from '@/lib/staffSession';
import { isAdmin } from '@/lib/staffAuth';
import { getServiceClient } from '@/lib/supabase/server';

const querySchema = z.object({
  search: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET /api/v1/admin/patients
 * List patients (newest first) with their order count, searchable by
 * name/email. Admin only.
 */
export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    search: url.searchParams.get('search') ?? undefined,
    page: url.searchParams.get('page') ?? 1,
    pageSize: url.searchParams.get('pageSize') ?? 50,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query.' }, { status: 400 });
  }

  const { search, page, pageSize } = parsed.data;
  const client = getServiceClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Collect matching patient ids first (search is across patient fields).
  let patientIds: string[] | null = null;
  if (search) {
    const { data } = await client
      .from('patients')
      .select('id')
      .or(`full_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
      .limit(500);
    patientIds = (data ?? []).map((p) => p.id as string);
    if (patientIds.length === 0) {
      return NextResponse.json({ patients: [], total: 0, page, pageSize });
    }
  }

  let query = client
    .from('patients')
    .select(
      'id, full_name, last_name, dob, sex, email, phone, created_at, orders(count)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  if (patientIds) {
    query = query.in('id', patientIds);
  }

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Could not load patients.' }, { status: 500 });
  }

  const patients = (data ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    lastName: p.last_name,
    dob: p.dob,
    sex: p.sex,
    email: p.email,
    phone: p.phone,
    createdAt: p.created_at,
    orderCount: Array.isArray(p.orders) ? p.orders.length : 0,
  }));

  return NextResponse.json({ patients, total: count ?? 0, page, pageSize });
}
