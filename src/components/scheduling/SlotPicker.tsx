"use client";

import { useMemo, useState } from "react";
import {
  formatTime,
  parseDateKey,
  toLocalDateKey,
  useSlots,
  useSlotsAvailability,
  type Availability,
  type Slot,
} from "@/hooks/useSlots";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
/** How many days of availability the calendar fetches at once. */
const LOOKAHEAD_DAYS = 42;

interface SlotPickerProps {
  /** YYYY-MM-DD of the chosen date, or null. */
  date: string | null;
  onDateChange: (date: string | null) => void;
  selectedSlot: Slot | null;
  onSlotChange: (slot: Slot | null) => void;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * User-friendly appointment picker: a month calendar showing which days have
 * open slots, plus a time grid for the chosen day. Fully accessible
 * (buttons with aria-pressed / aria-label), keyboard-friendly.
 */
export default function SlotPicker({
  date,
  onDateChange,
  selectedSlot,
  onSlotChange,
}: SlotPickerProps) {
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = date ? parseDateKey(date) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // Fetch availability for the next LOOKAHEAD_DAYS from today, once, so the
  // calendar can render "open days" at a glance.
  const availabilityState = useSlotsAvailability(
    toLocalDateKey(today),
    LOOKAHEAD_DAYS,
  );
  const availability: Availability =
    availabilityState.status === "ready" ? availabilityState.availability : {};

  // Fetch slots for the currently selected date.
  const slotsState = useSlots(date);
  const slotDateKey = date;

  const canGoPrev =
    viewMonth.getTime() >=
    new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const canGoNext =
    viewMonth.getTime() <=
    new Date(today.getFullYear(), today.getMonth() + 2, 1).getTime();

  const calendarDays = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startOffset = first.getDay();
    const start = addDays(first, -startOffset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [viewMonth]);

  const handlePrev = () =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const handleNext = () =>
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const isToday = (d: Date) => toLocalDateKey(d) === toLocalDateKey(today);

  return (
    <div className="rounded-xl border border-teal-border bg-white p-4 sm:p-5">
      {/* Calendar header: month + navigation */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrev}
          disabled={!canGoPrev}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-teal-border text-navy-deep transition hover:border-green disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹
        </button>
        <div className="text-sm font-semibold text-navy-deep">
          {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </div>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canGoNext}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-teal-border text-navy-deep transition hover:border-green disabled:cursor-not-allowed disabled:opacity-40"
        >
          ›
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((d) => {
          const key = toLocalDateKey(d);
          const inMonth = d.getMonth() === viewMonth.getMonth();
          const isPast = d.getTime() < today.getTime();
          const openCount = availability[key] ?? 0;
          const hasSlots = inMonth && !isPast && openCount > 0;
          const isSelected = date === key;
          return (
            <button
              key={key}
              type="button"
              disabled={!hasSlots}
              onClick={() => {
                onDateChange(isSelected ? null : key);
                onSlotChange(null);
              }}
              aria-label={
                hasSlots ? `${key}, ${openCount} slots available` : undefined
              }
              aria-pressed={isSelected}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition ${
                isSelected
                  ? "bg-green font-semibold text-white"
                  : hasSlots
                    ? "bg-teal-bg font-medium text-navy-deep hover:bg-teal-border"
                    : inMonth
                      ? "cursor-not-allowed text-muted/50"
                      : "cursor-not-allowed text-muted/30"
              }`}
            >
              <span
                className={
                  isToday(d) && !isSelected ? "font-bold text-green-dark" : ""
                }
              >
                {d.getDate()}
              </span>
              {hasSlots && !isSelected && (
                <span
                  className="mt-0.5 h-1 w-1 rounded-full bg-green"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-teal-bg ring-1 ring-inset ring-teal-border" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-green" />
          Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-white ring-1 ring-inset ring-[#e5edee]" />
          Unavailable
        </span>
      </div>

      {/* Time slots for chosen date */}
      {slotDateKey && (
        <div className="mt-4 border-t border-[#eef3f3] pt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-sm font-semibold text-navy-deep">
              {new Date(`${slotDateKey}T00:00:00`).toLocaleDateString(
                undefined,
                {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                },
              )}
            </div>
            <div className="text-xs text-muted">Select a time</div>
          </div>

          {slotsState.status === "loading" && (
            <p className="py-3 text-sm text-muted">Loading available times…</p>
          )}
          {slotsState.status === "error" && (
            <p className="py-3 text-sm text-red">{slotsState.message}</p>
          )}
          {slotsState.status === "ready" && slotsState.slots.length === 0 && (
            <p className="py-3 text-sm text-muted">
              No times left on this day.
            </p>
          )}
          {slotsState.status === "ready" && slotsState.slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slotsState.slots.map((slot) => {
                const available = slot.remaining > 0;
                const isSelected = selectedSlot?.id === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    disabled={!available}
                    onClick={() => onSlotChange(isSelected ? null : slot)}
                    aria-pressed={isSelected}
                    className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                      isSelected
                        ? "border-green bg-green text-white"
                        : available
                          ? "border-teal-border bg-white text-navy-deep hover:border-green"
                          : "cursor-not-allowed border-[#eef3f3] bg-slate-50 text-muted line-through"
                    }`}
                  >
                    {formatTime(slot.start)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selection summary */}
      {date && selectedSlot && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-teal-bg px-3 py-2 text-sm font-medium text-navy-deep">
          <span aria-hidden>✓</span>
          <span>
            {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}{" "}
            at {formatTime(selectedSlot.start)}
          </span>
        </div>
      )}
    </div>
  );
}
