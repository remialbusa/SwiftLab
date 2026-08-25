import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffSession } from '@/lib/staffSession';
import { getServiceClient } from '@/lib/supabase/server';

const querySchema = z.object({
  search: z.string().max(120).optional(),
  status: z.string().max(30).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * GET /api/v1/staff/orders
 * Staff-only, paginated order queue with optional search (patient name/email)
 * and status filter. Returns orders joined with patient + tests.
 */
export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    search: url.searchParams.get('search') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    page: url.searchParams.get('page') ?? 1,
    pageSize: url.searchParams.get('pageSize') ?? 20,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query.' }, { status: 400 });
  }

  const client = getServiceClient();
  const { search, status, page, pageSize } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Keyword search on patient name/email via the patients table.
  let patientIds: string[] | undefined;
  if (search) {
    const { data: patients } = await client
      .from('patients')
      .select('id')
      .or(search.includes('@')
        ? `email.ilike.%${search}%`
        : `full_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    patientIds = (patients ?? []).map((p) => p.id as string);
    if (patientIds.length === 0) {
      return NextResponse.json({ orders: [], total: 0 });
    }
  }

  let query = client
    .from('orders')
    .select('id, status, created_at, walk_in, patients(full_name, email), order_tests(lab_tests(name))', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (patientIds) {
    query = query.in('patient_id', patientIds);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Could not load orders.' }, { status: 500 });
  }

  const orders = (data ?? []).map((order) => ({
    id: order.id,
    status: order.status,
    createdAt: order.created_at,
    walkIn: order.walk_in,
    patientName: (order.patients as { full_name?: string } | null)?.full_name ?? 'Unknown',
    patientEmail: (order.patients as { email?: string } | null)?.email ?? '',
    tests: (order.order_tests as { lab_tests?: { name?: string } }[] ?? []).map((t) => t.lab_tests?.name ?? 'Unknown'),
  }));

  return NextResponse.json({ orders, total: count ?? 0, page, pageSize });
}