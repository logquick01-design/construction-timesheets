"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Cog } from "lucide-react";
import {
  clampLabourCalendarWeeks,
  MAX_LABOUR_CALENDAR_WEEKS,
  MIN_LABOUR_CALENDAR_WEEKS,
} from "@/lib/labour-calendar-preferences";
import {
  countAssignedColorTags,
  LABOUR_COLOR_OPTIONS,
  type LabourCalendarColorEntities,
  type LabourCalendarColorPrefs,
  type LabourColorId,
} from "@/lib/labour-calendar-colors";
import { cn } from "@/lib/utils";
import { Button, Label, Select } from "./ui";

function ColorTagPicker({
  value,
  onToggle,
  shape,
  ariaLabel,
}: {
  value: LabourColorId[];
  onToggle: (colorId: LabourColorId) => void;
  shape: "circle" | "square";
  ariaLabel: string;
}) {
  const selected = new Set(value);

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={ariaLabel}>
      {LABOUR_COLOR_OPTIONS.map((option) => {
        const isSelected = selected.has(option.id);
        return (
          <button
            key={option.id}
            type="button"
            title={option.label}
            aria-label={`${option.label}${isSelected ? ", selected" : ""}`}
            aria-pressed={isSelected}
            onClick={() => onToggle(option.id)}
            className={cn(
              "h-5 w-5 border-2 transition",
              shape === "square" ? "rounded-[3px]" : "rounded-full",
              isSelected ? "border-ink ring-1 ring-ink/30" : "border-white/80 hover:scale-110"
            )}
            style={{ backgroundColor: option.hex }}
          />
        );
      })}
    </div>
  );
}

function EntityColorList({
  emptyMessage,
  items,
  getColorIds,
  onToggleColor,
  showSite,
  shape,
}: {
  emptyMessage: string;
  items: Array<{ id: string; name: string; subtitle?: string; siteName?: string }>;
  getColorIds: (id: string) => LabourColorId[];
  onToggleColor: (id: string, colorId: LabourColorId) => void;
  showSite?: boolean;
  shape: "circle" | "square";
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted">{emptyMessage}</p>;
  }

  return (
    <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-border-light bg-fill/40 p-2">
          <div className="mb-1.5 min-w-0">
            <p className="truncate text-sm font-medium text-ink">{item.name}</p>
            {(item.subtitle || (showSite && item.siteName)) && (
              <p className="truncate text-[11px] text-muted">
                {[showSite && item.siteName, item.subtitle].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <ColorTagPicker
            value={getColorIds(item.id)}
            onToggle={(colorId) => onToggleColor(item.id, colorId)}
            shape={shape}
            ariaLabel={`Colour tags for ${item.name}`}
          />
        </li>
      ))}
    </ul>
  );
}

type ColorTagFilter = "companies" | "workers";

export function LabourCalendarSettings({
  weeks,
  onWeeksChange,
  colorEntities,
  colors,
  onCompanyColorToggle,
  onWorkerColorToggle,
}: {
  weeks: number;
  onWeeksChange: (weeks: number) => void;
  colorEntities: LabourCalendarColorEntities;
  colors: LabourCalendarColorPrefs;
  onCompanyColorToggle: (companyId: string, colorId: LabourColorId) => void;
  onWorkerColorToggle: (workerId: string, colorId: LabourColorId) => void;
}) {
  const [open, setOpen] = useState(false);
  const [colorTagsOpen, setColorTagsOpen] = useState(false);
  const [colorTagFilter, setColorTagFilter] = useState<ColorTagFilter>("companies");
  const ref = useRef<HTMLDivElement>(null);
  const showSite = colorEntities.companies.some((c) => c.siteName) || colorEntities.workers.some((w) => w.siteName);
  const assignedTagCount = countAssignedColorTags(colors);
  const companyItems = colorEntities.companies.map((company) => ({
    id: company.id,
    name: company.name,
    siteName: company.siteName,
  }));
  const workerItems = colorEntities.workers.map((worker) => ({
    id: worker.id,
    name: worker.name,
    siteName: worker.siteName,
    subtitle: worker.companyName ?? undefined,
  }));

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      // Mobile uses the backdrop button to close; avoid fighting fixed panel positioning.
      if (!window.matchMedia("(min-width: 640px)").matches) return;

      const target = e.target as Node | null;
      if (!target || !ref.current?.contains(target)) {
        setOpen(false);
        setColorTagsOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setColorTagsOpen(false);
      setColorTagFilter("companies");
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Calendar settings"
        className={cn("shrink-0 min-h-11 min-w-11 p-2 sm:min-h-0 sm:min-w-0", open && "bg-fill text-accent")}
      >
        <Cog className="h-4 w-4" aria-hidden />
      </Button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/20 sm:hidden"
            aria-label="Close calendar settings"
            onClick={() => {
              setOpen(false);
              setColorTagsOpen(false);
            }}
          />
          <div
            className={cn(
              "z-50 max-h-[75dvh] overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-lg",
              "fixed inset-x-4 bottom-4 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mt-1 sm:max-h-none sm:w-[22rem] sm:max-w-[calc(100vw-2rem)]"
            )}
          >
          <p className="mb-3 text-sm font-semibold text-ink">Calendar settings</p>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div>
              <Label htmlFor="labour-calendar-weeks">Weeks to show</Label>
              <Select
                id="labour-calendar-weeks"
                value={String(weeks)}
                onChange={(e) => onWeeksChange(clampLabourCalendarWeeks(Number(e.target.value)))}
              >
                {Array.from(
                  { length: MAX_LABOUR_CALENDAR_WEEKS - MIN_LABOUR_CALENDAR_WEEKS + 1 },
                  (_, i) => MIN_LABOUR_CALENDAR_WEEKS + i
                ).map((count) => (
                  <option key={count} value={count}>
                    {count} week{count === 1 ? "" : "s"}
                  </option>
                ))}
              </Select>
            </div>

            <div className="border-t border-border-light pt-3">
              <button
                type="button"
                onClick={() => setColorTagsOpen((value) => !value)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-2 text-left transition hover:bg-fill"
                aria-expanded={colorTagsOpen}
              >
                <span className="text-sm font-medium text-ink">
                  Colour tags
                  {assignedTagCount > 0 && (
                    <span className="ml-1.5 text-xs font-normal text-muted">
                      ({assignedTagCount} set)
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-muted transition", colorTagsOpen && "rotate-180")}
                  aria-hidden
                />
              </button>

              {colorTagsOpen && (
                <div className="mt-1 space-y-3 border-t border-border-light pt-3">
                  <p className="text-xs text-muted">
                    Tap colours to add or remove tags. Company tags appear as squares on bookings; worker tags appear
                    as circles. You can assign multiple tags to each company or worker.
                  </p>

                  <div>
                    <Label htmlFor="labour-calendar-color-filter">Assign tags to</Label>
                    <Select
                      id="labour-calendar-color-filter"
                      value={colorTagFilter}
                      onChange={(e) => setColorTagFilter(e.target.value as ColorTagFilter)}
                    >
                      <option value="companies">
                        Companies ({companyItems.length})
                      </option>
                      <option value="workers">
                        Workers ({workerItems.length})
                      </option>
                    </Select>
                  </div>

                  {colorTagFilter === "companies" ? (
                    <EntityColorList
                      emptyMessage="No companies available yet."
                      showSite={showSite}
                      shape="square"
                      items={companyItems}
                      getColorIds={(id) => colors.companies[id] ?? []}
                      onToggleColor={onCompanyColorToggle}
                    />
                  ) : (
                    <EntityColorList
                      emptyMessage="No workers available yet."
                      showSite={showSite}
                      shape="circle"
                      items={workerItems}
                      getColorIds={(id) => colors.workers[id] ?? []}
                      onToggleColor={onWorkerColorToggle}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
