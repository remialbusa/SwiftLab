/**
 * Order lifecycle service. Server-only (service role).
 *
 * - createOrder: patient + order + tracking magic link, emails link.
 * - lookupTracking: resolves a raw tracking token to an order summary.
 * - startResultsAccess: issues a results-scoped magic link for download.
 */

import { getServiceClient } from '@/lib/supabase/server';
import { generateToken, hashToken, generateTrackingCode } from '@/lib/token';
import { sendEmail } from '@/lib/email/send';
import { absoluteUrl, orderConfirmationHtml, resultsReadyHtml } from '@/lib/email/templates';
import { derivePdfPassword } from '@/lib/pdf/password';
import { writeAuditLog } from '@/lib/audit';
import { getSettings } from '@/lib/settings';

export interface CreateOrderInput {
  fullName: string;
  lastName: string;
  dob: string; // YYYY-MM-DD
  sex: string;
  email: string;
  phone?: string;
  testIds: string[];
  privacyConsent: boolean;
  /** Optional appointment slot to book for this order. */
  slotId?: string;
  /** Origin of the request (public URL the patient used). Used for email links. */
  origin?: string;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; trackingToken: string; trackingCode: string }
  | { ok: false; error: string };

/**
 * Register a new order (patient + order + link). Emails the tracking link.
 * Validates consent + tests before any write.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  if (!input.privacyConsent) {
    return { ok: false, error: 'Privacy consent is required.' };
  }
  if (input.testIds.length === 0) {
    return { ok: false, error: 'At least one test must be selected.' };
  }

  const client = getServiceClient();

  // Validate test ids exist and are active.
  const { data: tests } = await client
    .from('lab_tests')
    .select('id')
    .in('id', input.testIds)
    .eq('active', true);

  if (!tests || tests.length !== input.testIds.length) {
    return { ok: false, error: 'One or more selected tests are unavailable.' };
  }

  // Insert patient. Use an upsert keyed by email + dob to avoid dupes on retry.
  const { data: patient, error: patientErr } = await client
    .from('patients')
    .upsert(
      {
        full_name: input.fullName,
        last_name: input.lastName,
        dob: input.dob,
        sex: input.sex,
        email: input.email.toLowerCase(),
        phone: input.phone ?? null,
        privacy_consent: input.privacyConsent,
        consent_marketing: false,
      },
      { onConflict: 'email' },
    )
    .select()
    .single();

  if (patientErr || !patient) {
    return { ok: false, error: 'Could not create patient record.' };
  }

  const trackingCode = generateTrackingCode();
  const { data: order, error: orderErr } = await client
    .from('orders')
    .insert({
      patient_id: patient.id,
      status: 'pre_registered',
      tracking_token_hash: 'pending', // replaced below
      tracking_code: trackingCode,
      walk_in: false,
    })
    .select()
    .single();

  if (orderErr || !order) {
    return { ok: false, error: 'Could not create order.' };
  }

  const trackingToken = generateToken();
  const tokenHash = hashToken(trackingToken);
  const settings = await getSettings();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + settings.trackingLinkTtlDays);

  await client.from('orders').update({ tracking_token_hash: tokenHash }).eq('id', order.id);
  await client.from('order_tests').insert(input.testIds.map((labTestId) => ({ order_id: order.id, lab_test_id: labTestId })));
  await client.from('magic_links').insert({
    token_hash: tokenHash,
    order_id: order.id,
    purpose: 'tracking',
    expires_at: expiresAt.toISOString(),
  });

  // Optional appointment booking. Best-effort like email: a full/raced slot
  // must not lose the order, which is already persisted. Log it for follow-up.
  if (input.slotId) {
    const { data: booked, error: bookErr } = await client.rpc('book_slot', {
      p_order_id: order.id,
      p_slot_id: input.slotId,
    });
    if (bookErr || !booked) {
      console.error('[orders] slot booking failed', bookErr?.message ?? 'slot unavailable');
      await writeAuditLog({
        actorType: 'system',
        action: 'appointment.booking_failed',
        resourceType: 'order',
        resourceId: order.id,
        metadata: { slotId: input.slotId, error: bookErr?.message ?? 'slot unavailable' },
      });
    }
  }

  const trackingUrl = absoluteUrl(`/track/${trackingToken}`, input.origin);
  // Email is best-effort: a delivery failure must not lose the order, which
  // is already persisted. Log it for follow-up instead of failing the request.
  try {
    await sendEmail({
      to: input.email,
      subject: 'Your SwiftLab order tracking link',
      html: orderConfirmationHtml({
        patientName: input.fullName,
        trackingUrl,
        trackingCode,
      }),
    });
  } catch (err) {
    console.error('[orders] tracking email failed', err);
    await writeAuditLog({
      actorType: 'system',
      action: 'email.tracking_failed',
      resourceType: 'order',
      resourceId: order.id,
      metadata: { email: input.email, error: err instanceof Error ? err.message : 'unknown' },
    });
  }

  await writeAuditLog({
    actorType: 'patient',
    actorId: patient.id,
    action: 'order.created',
    resourceType: 'order',
    resourceId: order.id,
    metadata: { email: input.email, tests: input.testIds, code: trackingCode },
  });

  return { ok: true, orderId: order.id, trackingToken, trackingCode };
}

/** Stock existing patient record by a magic-link token. */
export async function resolveToken(token: string): Promise<{ orderId: string; purpose: string } | null> {
  const client = getServiceClient();
  const tokenHash = hashToken(token);
  const { data } = await client
    .from('magic_links')
    .select('order_id, purpose, expires_at, used_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (!data) return null;

  const expired = data.expires_at ? new Date(data.expires_at).getTime() < Date.now() : false;
  if (expired || data.used_at || data.revoked_at) return null;
  return { orderId: data.order_id as string, purpose: data.purpose as string };
}

/** Look up an order summary by the human-friendly tracking code (SL-XXXXXX). */
export async function getOrderByTrackingCode(code: string): Promise<OrderSummary | null> {
  const client = getServiceClient();
  const normalized = code.trim().toUpperCase();
  const { data: order } = await client
    .from('orders')
    .select('id, status, created_at, tracking_code')
    .eq('tracking_code', normalized)
    .maybeSingle();
  if (!order) return null;

  const { data: tests } = await client
    .from('order_tests')
    .select('lab_tests(name)')
    .eq('order_id', order.id);
  const { data: appointment } = await client
    .from('appointments')
    .select('slot_start, slot_end, status')
    .eq('order_id', order.id)
    .maybeSingle();

  return {
    id: order.id,
    status: order.status,
    createdAt: order.created_at,
    tests: (tests ?? []).map(
      (t) => (t.lab_tests as { name?: string } | null)?.name ?? 'Unknown',
    ),
    appointment: appointment
      ? {
          slotStart: appointment.slot_start as string,
          slotEnd: appointment.slot_end as string,
          status: appointment.status as string,
        }
      : null,
  };
}

/** Order summary for the tracking page. */
export async function getOrderForTracking(orderId: string, token: string): Promise<OrderSummary | null> {
  const client = getServiceClient();
  const { data: order } = await client
    .from('orders')
    .select('id, status, created_at, tracking_token_hash, patient_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.tracking_token_hash !== hashToken(token)) return null;

  const { data: tests } = await client
    .from('order_tests')
    .select('lab_tests(name)')
    .eq('order_id', orderId);
  const { data: appointment } = await client
    .from('appointments')
    .select('slot_start, slot_end, status')
    .eq('order_id', orderId)
    .maybeSingle();

  return {
    id: order.id,
    status: order.status,
    createdAt: order.created_at,
    tests: (tests ?? []).map((t) => (t.lab_tests as { name?: string })?.name ?? 'Unknown'),
    appointment: appointment
      ? {
          slotStart: appointment.slot_start as string,
          slotEnd: appointment.slot_end as string,
          status: appointment.status as string,
        }
      : null,
  };
}

export interface OrderSummary {
  id: string;
  status: string;
  createdAt: string;
  tests: string[];
  appointment: { slotStart: string; slotEnd: string; status: string } | null;
}

/** Issue a results-scoped magic link for the download page. */
export async function issueResultsLink(
  orderId: string,
  patientEmail: string,
  patientName: string,
  origin?: string,
): Promise<void> {
  const client = getServiceClient();
  const token = generateToken();
  const settings = await getSettings();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + settings.resultsLinkTtlDays);

  await client.from('magic_links').insert({
    token_hash: hashToken(token),
    order_id: orderId,
    purpose: 'results',
    expires_at: expiresAt.toISOString(),
  });

  const { data: patient } = await client.from('patients').select('last_name, dob').eq('email', patientEmail).maybeSingle();
  const passwordHint = patient
    ? `last name + birth date (e.g. ${derivePdfPassword({ lastName: patient.last_name, birthDate: patient.dob })})`
    : 'your last name and birth date (MMDDYYYY)';

  const resultsUrl = absoluteUrl(`/results/${token}`, origin);
  // Best-effort: a failed email must not roll back the results link, which
  // staff can re-send later.
  try {
    await sendEmail({
      to: patientEmail,
      subject: 'Your SwiftLab results are ready',
      html: resultsReadyHtml({
        patientName,
        resultsUrl,
        passwordHint,
      }),
    });
  } catch (err) {
    console.error('[orders] results email failed', err);
    await writeAuditLog({
      actorType: 'system',
      action: 'email.results_failed',
      resourceType: 'order',
      resourceId: orderId,
      metadata: { email: patientEmail, error: err instanceof Error ? err.message : 'unknown' },
    });
  }
}

/** Convenience for staff: verify a candidate password against a patient. */
export function patientPdfPassword(patient: { last_name: string; dob: string }): string {
  return derivePdfPassword({ lastName: patient.last_name, birthDate: patient.dob });
}