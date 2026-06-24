import type { SessionUser } from "./auth";

export function isAdmin(session: SessionUser) {
  return session.role === "ADMIN";
}

export function isReadOnly(session: SessionUser) {
  return session.role === "QS";
}

// Company-level management: sites + users. Admin only.
export function canManageData(session: SessionUser) {
  return session.role === "ADMIN";
}

// Site-level management: a site's companies, workers, categories and tasks.
// Admins can manage every site; site managers can manage their assigned sites.
export function canManageSite(session: SessionUser, siteId: string) {
  if (session.role === "ADMIN") return true;
  if (session.role === "SITE_MANAGER") return session.siteIds.includes(siteId);
  return false;
}

export function canLogHours(session: SessionUser) {
  return session.role === "ADMIN" || session.role === "SITE_MANAGER";
}

// Whether the user has any company-wide overview (all sites).
export function canViewAllSites(session: SessionUser) {
  return session.role === "ADMIN" || session.role === "QS";
}

export function canExport(session: SessionUser) {
  return true;
}

export function canCreateLabourRequest(session: SessionUser) {
  return session.role === "ADMIN" || session.role === "SITE_MANAGER";
}

export function canReviewLabourRequests(session: SessionUser) {
  return session.role === "ADMIN";
}
