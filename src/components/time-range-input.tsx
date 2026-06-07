"use client";

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
}: {
  startTime: string;
  finishTime: string;
  onStartChange: (time: string) => void;
  onFinishChange: (time: string) => void;
}) {
  const hours = calcHoursFromTimes(startTime, finishTime);
  const invalid = startTime && finishTime && hours == null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={startTime}
        onChange={(e) => onStartChange(e.target.value)}
        aria-label="Start time"
        className="min-w-[5.5rem] flex-1 text-center font-medium sm:flex-none"
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
        className="min-w-[5.5rem] flex-1 text-center font-medium sm:flex-none"
      >
        <option value="">Finish</option>
        {TIME_OPTIONS.map((t) => (
          <option key={`finish-${t}`} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <span
        className={`min-w-[4.5rem] text-center text-sm font-semibold sm:text-base ${
          invalid ? "text-red-600" : "text-slate-700"
        }`}
        aria-live="polite"
      >
        {formatHours(hours)}
      </span>
    </div>
  );
}
