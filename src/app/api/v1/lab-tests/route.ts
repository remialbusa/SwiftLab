import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

/**
 * GET /api/v1/lab-tests
 * Public list of active lab tests for the order form.
 */
export async function GET() {
  const client = getServiceClient();
  const { data, error } = await client
    .from('lab_tests')
    .select('id, name, code, cash_price, duration_minutes')
    .eq('active', true)
    .order('name');

  if (error) {
    return NextResponse.json({ error: 'Could not load lab tests.' }, { status: 500 });
  }
  return NextResponse.json({ tests: data ?? [] });
}