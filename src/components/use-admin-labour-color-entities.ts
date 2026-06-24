"use client";

import { useEffect, useState } from "react";
import {
  buildColorEntitiesFromWorkers,
  type LabourCalendarColorEntities,
} from "@/lib/labour-calendar-colors";
import { asWorkerList, readJsonResponse } from "@/lib/fetch-json";

type SiteSummary = { id: string; name: string };

type SiteWorker = {
  id: string;
  name: string;
  company: { id: string; name: string } | null;
};

const EMPTY_ENTITIES: LabourCalendarColorEntities = { companies: [], workers: [] };

export function useAdminLabourColorEntities() {
  const [entities, setEntities] = useState<LabourCalendarColorEntities>(EMPTY_ENTITIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      try {
        const sitesRes = await fetch("/api/sites", { signal: controller.signal });
        const sitesJson = await readJsonResponse<SiteSummary[]>(sitesRes);
        if (!sitesRes.ok || !sitesJson) {
          setEntities(EMPTY_ENTITIES);
          return;
        }

        const workerLists = await Promise.all(
          sitesJson.map(async (site) => {
            const res = await fetch(`/api/sites/${site.id}/workers`, { signal: controller.signal });
            const json = await readJsonResponse<unknown>(res);
            if (!res.ok || !asWorkerList(json)) return [] as SiteWorker[];
            return json as SiteWorker[];
          })
        );

        if (controller.signal.aborted) return;

        const companyMap = new Map<string, LabourCalendarColorEntities["companies"][number]>();
        const workerMap = new Map<string, LabourCalendarColorEntities["workers"][number]>();

        sitesJson.forEach((site, index) => {
          const built = buildColorEntitiesFromWorkers(workerLists[index] ?? [], site.name);
          for (const company of built.companies) {
            if (!companyMap.has(company.id)) companyMap.set(company.id, company);
          }
          for (const worker of built.workers) {
            if (!workerMap.has(worker.id)) workerMap.set(worker.id, worker);
          }
        });

        setEntities({
          companies: [...companyMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
          workers: [...workerMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setEntities(EMPTY_ENTITIES);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, []);

  return { entities, loading };
}
