import { z } from "zod";
import { prisma } from "./prisma";

export type SiteFeatures = {
  bookingCalendar: boolean;
  logHours: boolean;
  exports: boolean;
};

export const DEFAULT_SITE_FEATURES: SiteFeatures = {
  bookingCalendar: true,
  logHours: true,
  exports: true,
};

export const SITE_FEATURE_LABELS: Record<
  keyof SiteFeatures,
  { label: string; description: string }
> = {
  bookingCalendar: {
    label: "Booking calendar",
    description: "Look Ahead labour requests and company labour calendar for this site.",
  },
  logHours: {
    label: "Log hours",
    description: "Daily timesheet entry for workers on this site.",
  },
  exports: {
    label: "Exports",
    description: "Payroll CSV and PDF reports for this site.",
  },
};

export const siteFeaturesSchema = z.object({
  bookingCalendar: z.boolean(),
  logHours: z.boolean(),
  exports: z.boolean(),
});

export function mergeSiteFeatures(stored: unknown): SiteFeatures {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_SITE_FEATURES };

  const parsed = siteFeaturesSchema.safeParse({
    ...DEFAULT_SITE_FEATURES,
    ...(stored as Record<string, unknown>),
  });

  return parsed.success ? parsed.data : { ...DEFAULT_SITE_FEATURES };
}

export async function loadSiteFeatures(siteId: string): Promise<SiteFeatures> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { features: true },
  });
  return mergeSiteFeatures(site?.features);
}

export async function loadSiteFeaturesMap(
  siteIds: string[]
): Promise<Map<string, SiteFeatures>> {
  if (siteIds.length === 0) return new Map();

  const sites = await prisma.site.findMany({
    where: { id: { in: siteIds } },
    select: { id: true, features: true },
  });

  return new Map(sites.map((site) => [site.id, mergeSiteFeatures(site.features)]));
}

export function isSiteFeatureEnabled(
  features: SiteFeatures,
  feature: keyof SiteFeatures
): boolean {
  return features[feature];
}
