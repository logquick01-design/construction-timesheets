"use client";

import { cn } from "@/lib/utils";
import { Select } from "./ui";
import {
  TIME_OPTIONS,
  calcHoursFromTimes,
  formatHours,
} from "@/lib/time-utils";

export function TimeRangeInput({
  startTime,
  finishTime,
  onStartChange,
  onFinishChange,
  compact = false,
}: {
  startTime: string;
  finishTime: string;
  onStartChange: (time: string) => void;
  onFinishChange: (time: string) => void;
  compact?: boolean;
}) {
  const hours = calcHoursFromTimes(startTime, finishTime);
  const invalid = startTime && finishTime && hours == null;

  return (
    <div className={cn("flex flex-wrap items-center", compact ? "gap-1" : "gap-2")}>
      <Select
        value={startTime}
        onChange={(e) => onStartChange(e.target.value)}
        aria-label="Start time"
        className={cn(
          "flex-1 text-center font-medium sm:flex-none",
          compact ? "min-w-[4.75rem] px-2 py-1 text-sm" : "min-w-[5.5rem]"
        )}
      >
        <option value="">Start</option>
        {TIME_OPTIONS.map((t) => (
          <option key={`start-${t}`} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <span className="text-slate-400" aria-hidden>
        –
      </span>
      <Select
        value={finishTime}
        onChange={(e) => onFinishChange(e.target.value)}
        aria-label="Finish time"
        className={cn(
          "flex-1 text-center font-medium sm:flex-none",
          compact ? "min-w-[4.75rem] px-2 py-1 text-sm" : "min-w-[5.5rem]"
        )}
      >
        <option value="">Finish</option>
        {TIME_OPTIONS.map((t) => (
          <option key={`finish-${t}`} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <span
        className={cn(
          "min-w-[3.5rem] text-center font-semibold",
          compact ? "text-xs" : "min-w-[4.5rem] text-sm sm:text-base",
          invalid ? "text-red-600" : "text-slate-700"
        )}
        aria-live="polite"
      >
        {formatHours(hours)}
      </span>
    </div>
  );
}
