import { eachDayInRange, formatDate, parseDateInput, startOfDay } from "./utils";

export function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

export function weekdaysInRange(from: Date, to: Date): Date[] {
  return eachDayInRange(from, to).filter(isWeekday);
}

export function weekdaysForWeekContaining(reference: Date): Date[] {
  const day = reference.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = startOfDay(reference);
  monday.setDate(reference.getDate() + diffToMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return weekdaysInRange(monday, friday);
}

export function nextWeekWeekdays(reference = new Date()): Date[] {
  const next = new Date(reference);
  next.setDate(reference.getDate() + 7);
  return weekdaysForWeekContaining(next);
}

export function thisWeekWeekdays(reference = new Date()): Date[] {
  return weekdaysForWeekContaining(reference);
}

export function sortDateStrings(dates: string[]): string[] {
  return [...dates].sort();
}

export function uniqueDateStrings(dates: string[]): string[] {
  return sortDateStrings([...new Set(dates)]);
}

export function datesToStrings(dates: Date[]): string[] {
  return uniqueDateStrings(dates.map(formatDate));
}

export function stringsToDates(dates: string[]): Date[] {
  return sortDateStrings(dates).map(parseDateInput);
}

export function formatDateRange(dates: string[]): string {
  const sorted = sortDateStrings(dates);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return sorted[0];
  return `${sorted[0]} – ${sorted[sorted.length - 1]}`;
}

/** Move one day slot from `fromDate` to `toDate`; returns null if invalid or unchanged. */
export function rescheduleRequestDate(
  dates: string[],
  fromDate: string,
  toDate: string
): string[] | null {
  if (fromDate === toDate || !dates.includes(fromDate) || dates.includes(toDate)) {
    return null;
  }
  return uniqueDateStrings(dates.map((d) => (d === fromDate ? toDate : d)));
}

export function formatDateRangeDisplay(dates: string[]): string {
  const sorted = sortDateStrings(dates);
  if (sorted.length === 0) return "";
  const fmt = (s: string) => {
    const d = parseDateInput(s);
    const day = String(d.getDate()).padStart(2, "0");
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${m}`;
  };
  if (sorted.length === 1) return fmt(sorted[0]);
  return `${fmt(sorted[0])} – ${fmt(sorted[sorted.length - 1])}`;
}
