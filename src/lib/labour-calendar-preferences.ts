export const DEFAULT_LABOUR_CALENDAR_WEEKS = 2;
export const MIN_LABOUR_CALENDAR_WEEKS = 1;
export const MAX_LABOUR_CALENDAR_WEEKS = 8;

const STORAGE_KEY = "labour-calendar-weeks-ahead";

export function clampLabourCalendarWeeks(value: number): number {
  return Math.min(MAX_LABOUR_CALENDAR_WEEKS, Math.max(MIN_LABOUR_CALENDAR_WEEKS, Math.round(value)));
}

export function readLabourCalendarWeeks(): number {
  if (typeof window === "undefined") return DEFAULT_LABOUR_CALENDAR_WEEKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LABOUR_CALENDAR_WEEKS;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return DEFAULT_LABOUR_CALENDAR_WEEKS;
    return clampLabourCalendarWeeks(parsed);
  } catch {
    return DEFAULT_LABOUR_CALENDAR_WEEKS;
  }
}

export function writeLabourCalendarWeeks(weeks: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(clampLabourCalendarWeeks(weeks)));
  } catch {
    // ignore quota / private mode
  }
}
