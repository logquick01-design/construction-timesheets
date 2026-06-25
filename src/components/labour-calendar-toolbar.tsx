"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui";
import { addDays, formatWeekLabel, getMondayOfWeek } from "./labour-calendar-shared";

export function LabourCalendarToolbar({
  weekStart,
  onWeekStartChange,
  weeksShown,
  trailing,
}: {
  weekStart: Date;
  onWeekStartChange: (next: Date) => void;
  weeksShown: number;
  trailing?: React.ReactNode;
}) {
  const stepDays = weeksShown * 7;
  const navLabel = weeksShown === 1 ? "week" : "weeks";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex items-center justify-between gap-1 sm:justify-start sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
          onClick={() => onWeekStartChange(addDays(weekStart, -stepDays))}
          aria-label={`Previous ${weeksShown} ${navLabel}`}
        >
          <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
        </Button>
        <span className="min-w-0 flex-1 px-1 text-center text-sm font-medium sm:min-w-36 sm:flex-none">
          {formatWeekLabel(weekStart, weeksShown)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
          onClick={() => onWeekStartChange(addDays(weekStart, stepDays))}
          aria-label={`Next ${weeksShown} ${navLabel}`}
        >
          <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11 shrink-0 sm:min-h-0"
          onClick={() => onWeekStartChange(getMondayOfWeek(new Date()))}
        >
          Today
        </Button>
      </div>

      {trailing && (
        <div className="w-full sm:ml-auto sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
          {trailing}
        </div>
      )}
    </div>
  );
}
