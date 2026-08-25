/**
 * Audit logging. Every sensitive action (result view, PDF download, payment
 * confirmation, staff login/denial) is written here as an evidence trail.
 *
 * Runs server-side with the service role so entries are recorded even when the
 * acting party has no direct insert rights (e.g. a patient downloading a PDF).
 */

import { getServiceClient } from '@/lib/supabase/server';

export interface AuditParams {
  actorType: 'patient' | 'staff' | 'system';
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

/** Best-effort write; failures are logged to console, never thrown. */
export async function writeAuditLog(entry: AuditParams): Promise<void> {
  try {
    const client = getServiceClient();
    await client.from('audit_logs').insert({
      actor_type: entry.actorType,
      actor_id: entry.actorId,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      metadata: entry.metadata ?? {},
    });
  } catch (err) {
    console.error('[audit] failed to write log', err);
  }
}