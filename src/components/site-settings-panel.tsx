"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SITE_FEATURES,
  SITE_FEATURE_LABELS,
  type SiteFeatures,
} from "@/lib/site-features";
import { Button } from "./ui";

export function SiteSettingsPanel({
  siteId,
  siteName,
  initialFeatures,
}: {
  siteId: string;
  siteName: string;
  initialFeatures?: SiteFeatures;
}) {
  const [features, setFeatures] = useState<SiteFeatures>(initialFeatures ?? DEFAULT_SITE_FEATURES);
  const [loading, setLoading] = useState(!initialFeatures);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/sites");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load settings");
        return;
      }
      const site = (json as { id: string; features?: SiteFeatures }[]).find((s) => s.id === siteId);
      if (!site) {
        setError("Site not found");
        return;
      }
      setFeatures(site.features ?? DEFAULT_SITE_FEATURES);
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => {
    if (initialFeatures) {
      setFeatures(initialFeatures);
      setLoading(false);
      return;
    }
    load();
  }, [initialFeatures, load]);

  function toggleFeature(key: keyof SiteFeatures) {
    setSaved(false);
    setFeatures((current) => ({ ...current, [key]: !current[key] }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/admin/sites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: siteId, features }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to save settings");
        return;
      }
      setFeatures(json.features ?? features);
      setSaved(true);
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading settings…</p>;
  }

  return (
    <div>
      <h3 className="font-semibold text-ink">Features for {siteName}</h3>
      <p className="mt-1 text-sm text-muted">
        Choose which parts of LogQ are enabled on this site. Disabled features are hidden from site
        navigation and blocked in the app.
      </p>

      <ul className="mt-4 divide-y divide-border-light">
        {(Object.keys(SITE_FEATURE_LABELS) as (keyof SiteFeatures)[]).map((key) => {
          const meta = SITE_FEATURE_LABELS[key];
          return (
            <li key={key} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="font-medium text-ink">{meta.label}</p>
                <p className="text-sm text-muted">{meta.description}</p>
              </div>
              <label className="flex shrink-0 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={features[key]}
                  onChange={() => toggleFeature(key)}
                />
                {features[key] ? "On" : "Off"}
              </label>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="mt-3 text-sm text-green-700">Settings saved.</p>
      )}

      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
