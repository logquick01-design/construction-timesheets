"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readLabourCalendarColors,
  toggleEntityColor,
  writeLabourCalendarColors,
  type LabourCalendarColorPrefs,
  type LabourColorId,
} from "@/lib/labour-calendar-colors";

export function useLabourCalendarColors() {
  const [colors, setColorsState] = useState<LabourCalendarColorPrefs>({ companies: {}, workers: {} });

  useEffect(() => {
    setColorsState(readLabourCalendarColors());
  }, []);

  const toggleCompanyColor = useCallback((companyId: string, colorId: LabourColorId) => {
    setColorsState((current) => {
      const nextTags = toggleEntityColor(current.companies[companyId] ?? [], colorId);
      const companies = { ...current.companies };
      if (nextTags.length === 0) delete companies[companyId];
      else companies[companyId] = nextTags;

      const next = { ...current, companies };
      writeLabourCalendarColors(next);
      return next;
    });
  }, []);

  const toggleWorkerColor = useCallback((workerId: string, colorId: LabourColorId) => {
    setColorsState((current) => {
      const nextTags = toggleEntityColor(current.workers[workerId] ?? [], colorId);
      const workers = { ...current.workers };
      if (nextTags.length === 0) delete workers[workerId];
      else workers[workerId] = nextTags;

      const next = { ...current, workers };
      writeLabourCalendarColors(next);
      return next;
    });
  }, []);

  return { colors, toggleCompanyColor, toggleWorkerColor };
}
