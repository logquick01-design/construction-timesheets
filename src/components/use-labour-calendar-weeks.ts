"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clampLabourCalendarWeeks,
  DEFAULT_LABOUR_CALENDAR_WEEKS,
  readLabourCalendarWeeks,
  writeLabourCalendarWeeks,
} from "@/lib/labour-calendar-preferences";

export function useLabourCalendarWeeks() {
  const [weeks, setWeeksState] = useState(DEFAULT_LABOUR_CALENDAR_WEEKS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWeeksState(readLabourCalendarWeeks());
    setReady(true);
  }, []);

  const setWeeks = useCallback((value: number) => {
    const next = clampLabourCalendarWeeks(value);
    setWeeksState(next);
    writeLabourCalendarWeeks(next);
  }, []);

  return { weeks, setWeeks, ready };
}
