'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface Slot {
  id: string;
  start: string; // HH:mm
  end: string; // HH:mm
  remaining: number;
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; slots: Slot[] };

/**
 * Loads available appointment slots for a given date from the public
 * schedule endpoint. The endpoint lazily generates slots for the requested
 * date, so a fresh date always has options.
 */
export function useSlots(date: string | null): FetchState {
  const [state, setState] = useState<FetchState>({ status: 'idle' });

  useEffect(() => {
    if (!date) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    const load = async () => {
      try {
        const res = await apiFetch(`/api/v1/schedule/slots?date=${encodeURIComponent(date)}`);
        if (!res.ok) throw new Error('Failed to load slots');
        const json = (await res.json()) as { slots: Slot[] };
        if (!cancelled) setState({ status: 'ready', slots: json.slots });
      } catch (err: unknown) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [date]);

  return state;
}

/** Availability counts per date (YYYY-MM-DD -> number of open slots). */
export type Availability = Record<string, number>;

type RangeFetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; availability: Availability };

/** Local YYYY-MM-DD (no UTC shift). */
export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD key into a local Date at midnight. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Loads per-date availability for a range of days in one request, so the
 * calendar can show which days have open slots at a glance.
 */
export function useSlotsAvailability(startDate: string | null, days: number): RangeFetchState {
  const [state, setState] = useState<RangeFetchState>({ status: 'idle' });

  useEffect(() => {
    if (!startDate) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    const load = async () => {
      try {
        const start = parseDateKey(startDate);
        const end = addDays(start, days - 1);
        const rangeEnd = toLocalDateKey(end);
        const res = await apiFetch(
          `/api/v1/schedule/slots?date=${encodeURIComponent(startDate)}&rangeEnd=${encodeURIComponent(rangeEnd)}`,
        );
        if (!res.ok) throw new Error('Failed to load availability');
        const json = (await res.json()) as { availability?: Availability };
        if (!cancelled) setState({ status: 'ready', availability: json.availability ?? {} });
      } catch (err: unknown) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [startDate, days]);

  return state;
}

/** Convenience: whether a slot still has capacity. */
export function isSlotAvailable(slot: Slot): boolean {
  return slot.remaining > 0;
}

/** Format an HH:mm time to a friendly 12-hour label (e.g. "9:00 AM"). */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}