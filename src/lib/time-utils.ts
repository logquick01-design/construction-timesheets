const STEP_MINUTES = 30;
const LUNCH_START_MINUTES = 13 * 60;
const LUNCH_DEDUCTION_MINUTES = 30;

function spansLunch(startM: number, finishM: number): boolean {
  return startM < LUNCH_START_MINUTES && finishM > LUNCH_START_MINUTES;
}

export const TIME_OPTIONS: string[] = (() => {
  const options: string[] = [];
  for (let m = 0; m < 24 * 60; m += STEP_MINUTES) {
    options.push(minutesToTime(m));
  }
  return options;
})();

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function calcHoursFromTimes(start: string, finish: string): number | null {
  if (!start || !finish) return null;
  const startM = timeToMinutes(start);
  let finishM = timeToMinutes(finish);
  if (finishM <= startM) finishM += 24 * 60;
  let netMinutes = finishM - startM;
  if (spansLunch(startM, finishM)) {
    netMinutes -= LUNCH_DEDUCTION_MINUTES;
  }
  const hours = netMinutes / 60;
  if (hours <= 0 || hours > 24) return null;
  return Math.round(hours * 100) / 100;
}

function snapToStep(minutes: number): number {
  return Math.round(minutes / STEP_MINUTES) * STEP_MINUTES;
}

export function finishTimeFromHours(start: string, hours: number): string {
  const startM = timeToMinutes(start);
  let finishM = startM + Math.round(hours * 60);
  if (startM < LUNCH_START_MINUTES && finishM > LUNCH_START_MINUTES) {
    finishM += LUNCH_DEDUCTION_MINUTES;
  }
  return minutesToTime(snapToStep(finishM));
}

export function formatHours(hours: number | null): string {
  if (hours == null || hours <= 0) return "—";
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} hrs` : `${rounded} hrs`;
}

export const DEFAULT_START_TIME = "07:00";
export const DEFAULT_FINISH_TIME = "15:30";
