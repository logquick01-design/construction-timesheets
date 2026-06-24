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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onWeekStartChange(addDays(weekStart, -stepDays))}
          aria-label={`Previous ${weeksShown} ${navLabel}`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-36 text-center text-sm font-medium">
          {formatWeekLabel(weekStart, weeksShown)}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onWeekStartChange(addDays(weekStart, stepDays))}
          aria-label={`Next ${weeksShown} ${navLabel}`}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onWeekStartChange(getMondayOfWeek(new Date()))}
        >
          Today
        </Button>
      </div>

      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}
