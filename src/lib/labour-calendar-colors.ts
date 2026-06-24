export type LabourColorId =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "blue"
  | "purple"
  | "pink"
  | "gray"
  | "brown";

export const LABOUR_COLOR_OPTIONS: { id: LabourColorId; label: string; hex: string }[] = [
  { id: "red", label: "Red", hex: "#FF3B30" },
  { id: "orange", label: "Orange", hex: "#FF9500" },
  { id: "yellow", label: "Yellow", hex: "#FFCC00" },
  { id: "green", label: "Green", hex: "#34C759" },
  { id: "teal", label: "Teal", hex: "#5AC8FA" },
  { id: "blue", label: "Blue", hex: "#007AFF" },
  { id: "purple", label: "Purple", hex: "#AF52DE" },
  { id: "pink", label: "Pink", hex: "#FF2D55" },
  { id: "gray", label: "Gray", hex: "#8E8E93" },
  { id: "brown", label: "Brown", hex: "#A2845E" },
];

const COLOR_BY_ID = Object.fromEntries(
  LABOUR_COLOR_OPTIONS.map((option) => [option.id, option])
) as Record<LabourColorId, (typeof LABOUR_COLOR_OPTIONS)[number]>;

export type LabourCalendarColorPrefs = {
  companies: Record<string, LabourColorId[]>;
  workers: Record<string, LabourColorId[]>;
};

const STORAGE_KEY = "labour-calendar-color-tags";

const EMPTY_PREFS: LabourCalendarColorPrefs = { companies: {}, workers: {} };

function isColorId(value: string): value is LabourColorId {
  return value in COLOR_BY_ID;
}

function normalizeEntityColors(raw: unknown): Record<string, LabourColorId[]> {
  if (!raw || typeof raw !== "object") return {};

  const result: Record<string, LabourColorId[]> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      const colors = value.filter((item): item is LabourColorId => typeof item === "string" && isColorId(item));
      if (colors.length > 0) result[id] = [...new Set(colors)];
    } else if (typeof value === "string" && isColorId(value)) {
      result[id] = [value];
    }
  }
  return result;
}

export function readLabourCalendarColors(): LabourCalendarColorPrefs {
  if (typeof window === "undefined") return EMPTY_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PREFS;
    const parsed = JSON.parse(raw) as Partial<LabourCalendarColorPrefs>;
    return {
      companies: normalizeEntityColors(parsed.companies),
      workers: normalizeEntityColors(parsed.workers),
    };
  } catch {
    return EMPTY_PREFS;
  }
}

export function writeLabourCalendarColors(prefs: LabourCalendarColorPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function colorHex(colorId: LabourColorId | null | undefined): string | null {
  if (!colorId) return null;
  return COLOR_BY_ID[colorId]?.hex ?? null;
}

export function countAssignedColorTags(prefs: LabourCalendarColorPrefs): number {
  let count = 0;
  for (const tags of Object.values(prefs.companies)) count += tags.length;
  for (const tags of Object.values(prefs.workers)) count += tags.length;
  return count;
}

export function toggleEntityColor(
  current: LabourColorId[],
  colorId: LabourColorId
): LabourColorId[] {
  return current.includes(colorId)
    ? current.filter((id) => id !== colorId)
    : [...current, colorId];
}

export type LabourCalendarCardWorker = {
  workerId: string;
  companyId?: string | null;
};

export type CardBookingColorTags = {
  companyTags: string[];
  workerTags: string[];
};

export function cardBookingColorTags(
  workers: LabourCalendarCardWorker[],
  prefs: LabourCalendarColorPrefs
): CardBookingColorTags {
  const companyTags: string[] = [];
  const workerTags: string[] = [];
  const seenCompanyTags = new Set<string>();
  const seenWorkerTags = new Set<string>();

  for (const worker of workers) {
    if (worker.companyId) {
      for (const colorId of prefs.companies[worker.companyId] ?? []) {
        const hex = colorHex(colorId);
        const key = `${worker.companyId}:${hex}`;
        if (hex && !seenCompanyTags.has(key)) {
          seenCompanyTags.add(key);
          companyTags.push(hex);
        }
      }
    }

    for (const colorId of prefs.workers[worker.workerId] ?? []) {
      const hex = colorHex(colorId);
      const key = `${worker.workerId}:${hex}`;
      if (hex && !seenWorkerTags.has(key)) {
        seenWorkerTags.add(key);
        workerTags.push(hex);
      }
    }
  }

  return { companyTags, workerTags };
}

export type LabourCalendarColorCompany = {
  id: string;
  name: string;
  siteName?: string;
};

export type LabourCalendarColorWorker = {
  id: string;
  name: string;
  companyId: string | null;
  companyName?: string | null;
  siteName?: string;
};

export type LabourCalendarColorEntities = {
  companies: LabourCalendarColorCompany[];
  workers: LabourCalendarColorWorker[];
};

export function buildColorEntitiesFromWorkers(
  workers: Array<{
    id: string;
    name: string;
    company: { id: string; name: string } | null;
  }>,
  siteName?: string
): LabourCalendarColorEntities {
  const companyMap = new Map<string, LabourCalendarColorCompany>();

  for (const worker of workers) {
    if (worker.company && !companyMap.has(worker.company.id)) {
      companyMap.set(worker.company.id, {
        id: worker.company.id,
        name: worker.company.name,
        siteName,
      });
    }
  }

  return {
    companies: [...companyMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
    workers: workers
      .map((worker) => ({
        id: worker.id,
        name: worker.name,
        companyId: worker.company?.id ?? null,
        companyName: worker.company?.name ?? null,
        siteName,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
