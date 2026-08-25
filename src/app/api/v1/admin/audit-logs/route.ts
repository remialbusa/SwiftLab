import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStaffSession } from '@/lib/staffSession';
import { isAdmin } from '@/lib/staffAuth';
import { getServiceClient } from '@/lib/supabase/server';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().max(80).optional(),
});

/**
 * GET /api/v1/admin/audit-logs — paginated audit trail (admin only).
 */
export async function GET(request: Request) {
  const session = await getStaffSession();
  if (!session || !(await isAdmin(session.identity.id))) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    page: url.searchParams.get('page') ?? 1,
    pageSize: url.searchParams.get('pageSize') ?? 50,
    action: url.searchParams.get('action') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query.' }, { status: 400 });
  }

  const client = getServiceClient();
  const { page, pageSize, action } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from('audit_logs')
    .select('id, actor_type, actor_id, action, resource_type, resource_id, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (action) {
    query = query.eq('action', action);
  }

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Could not load audit logs.' }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [], total: count ?? 0, page, pageSize });
}