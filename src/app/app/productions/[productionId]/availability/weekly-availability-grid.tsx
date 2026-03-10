"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildWeekDates,
  formatLocalWeekday,
  formatTimeLabel,
  localDateFromWallClock,
  localDateKey,
  splitWindowForWeek,
  type LocalDate,
  type LocalWallClock,
  type UtcWindow,
} from "@/lib/availabilityTime";

type WeeklyAvailabilityGridProps = {
  windows: UtcWindow[];
  weekStart: LocalDate;
  displayTimeZone: string;
  isBusy?: boolean;
  onPaintRange: (startLocal: LocalWallClock, endLocal: LocalWallClock) => void;
  onDeleteWindow: (windowId: string) => void;
};

const SLOT_MINUTES = 15;
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;

type DragCell = {
  dayIndex: number;
  slotIndex: number;
};

function toLocalFromSlot(weekStart: LocalDate, absoluteSlot: number): LocalWallClock {
  const dayIndex = Math.floor(absoluteSlot / SLOTS_PER_DAY);
  const slotIndex = absoluteSlot % SLOTS_PER_DAY;
  const day = buildWeekDates(weekStart)[dayIndex] ?? weekStart;
  const minutes = slotIndex * SLOT_MINUTES;

  return {
    year: day.year,
    month: day.month,
    day: day.day,
    hour: Math.floor(minutes / 60),
    minute: minutes % 60,
  };
}

export default function WeeklyAvailabilityGrid({
  windows,
  weekStart,
  displayTimeZone,
  isBusy = false,
  onPaintRange,
  onDeleteWindow,
}: WeeklyAvailabilityGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<DragCell | null>(null);
  const [dragCurrent, setDragCurrent] = useState<DragCell | null>(null);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const finish = () => {
      if (!dragStart || !dragCurrent) {
        setIsDragging(false);
        setDragStart(null);
        setDragCurrent(null);
        return;
      }

      const startAbs = dragStart.dayIndex * SLOTS_PER_DAY + dragStart.slotIndex;
      const endAbs = dragCurrent.dayIndex * SLOTS_PER_DAY + dragCurrent.slotIndex;

      const rangeStartAbs = Math.min(startAbs, endAbs);
      const rangeEndAbs = Math.max(startAbs, endAbs) + 1;

      onPaintRange(
        toLocalFromSlot(weekStart, rangeStartAbs),
        toLocalFromSlot(weekStart, rangeEndAbs)
      );

      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
    };

    window.addEventListener("mouseup", finish);
    return () => {
      window.removeEventListener("mouseup", finish);
    };
  }, [dragCurrent, dragStart, isDragging, onPaintRange, weekStart]);

  const weekDates = useMemo(() => buildWeekDates(weekStart), [weekStart]);

  const daySegments = useMemo(() => {
    const all = windows.flatMap((window) => splitWindowForWeek(window, weekStart, displayTimeZone));
    return Array.from({ length: 7 }, (_, dayIndex) => all.filter((segment) => segment.dayIndex === dayIndex));
  }, [displayTimeZone, weekStart, windows]);

  const highlightRange = useMemo(() => {
    if (!dragStart || !dragCurrent) {
      return new Set<number>();
    }

    const from = dragStart.dayIndex * SLOTS_PER_DAY + dragStart.slotIndex;
    const to = dragCurrent.dayIndex * SLOTS_PER_DAY + dragCurrent.slotIndex;
    const min = Math.min(from, to);
    const max = Math.max(from, to);

    const slots = new Set<number>();
    for (let index = min; index <= max; index += 1) {
      slots.add(index);
    }
    return slots;
  }, [dragCurrent, dragStart]);

  const timeLabels = useMemo(
    () => Array.from({ length: 24 }, (_, hour) => formatTimeLabel(hour * 60)),
    []
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="min-w-240">
        <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-2">
          <div />
          {weekDates.map((date) => (
            <div
              key={localDateKey(date)}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-2 text-center text-xs font-semibold text-slate-200"
            >
              {formatLocalWeekday(date, displayTimeZone)}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-[72px_repeat(7,minmax(0,1fr))] gap-2">
          <div className="relative h-240">
            {timeLabels.map((label, hour) => (
              <div
                key={label}
                className="absolute right-1 text-[10px] text-slate-400"
                style={{ top: `${(hour / 24) * 100}%`, transform: "translateY(-50%)" }}
              >
                {label}
              </div>
            ))}
          </div>

          {weekDates.map((date, dayIndex) => (
            <div
              key={localDateKey(date)}
              className="relative h-240 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40"
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(to bottom, rgba(100,116,139,0.25) 1px, transparent 1px)",
                  backgroundSize: `100% ${100 / SLOTS_PER_DAY}%`,
                }}
              />

              <div className="absolute inset-0 grid" style={{ gridTemplateRows: `repeat(${SLOTS_PER_DAY}, minmax(0, 1fr))` }}>
                {Array.from({ length: SLOTS_PER_DAY }, (_, slotIndex) => {
                  const absolute = dayIndex * SLOTS_PER_DAY + slotIndex;
                  const isSelected = highlightRange.has(absolute);

                  return (
                    <button
                      key={`${dayIndex}-${slotIndex}`}
                      type="button"
                      aria-label={`Paint ${localDateKey(localDateFromWallClock({
                        year: date.year,
                        month: date.month,
                        day: date.day,
                        hour: Math.floor((slotIndex * SLOT_MINUTES) / 60),
                        minute: (slotIndex * SLOT_MINUTES) % 60,
                      }))} slot`}
                      className={isSelected ? "bg-amber-400/30" : "hover:bg-slate-700/40"}
                      onMouseDown={() => {
                        if (isBusy) {
                          return;
                        }
                        setIsDragging(true);
                        setDragStart({ dayIndex, slotIndex });
                        setDragCurrent({ dayIndex, slotIndex });
                      }}
                      onMouseEnter={() => {
                        if (!isDragging || isBusy) {
                          return;
                        }
                        setDragCurrent({ dayIndex, slotIndex });
                      }}
                      disabled={isBusy}
                    />
                  );
                })}
              </div>

              {daySegments[dayIndex]?.map((segment) => {
                const top = (segment.startMinute / (24 * 60)) * 100;
                const height = ((segment.endMinute - segment.startMinute) / (24 * 60)) * 100;
                const color = segment.kind === "AVAILABLE" ? "bg-emerald-400/45" : "bg-rose-400/45";

                return (
                  <button
                    type="button"
                    key={`${segment.id}-${segment.startMinute}-${segment.endMinute}`}
                    title="Click to delete this window"
                    className={`absolute left-1 right-1 rounded-md border border-white/20 ${color}`}
                    style={{ top: `${top}%`, height: `${Math.max(height, 0.75)}%` }}
                    onClick={() => onDeleteWindow(segment.id)}
                    disabled={isBusy}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Drag across slots to paint 15-minute availability blocks. Click a colored block to delete it.
      </p>
    </div>
  );
}
