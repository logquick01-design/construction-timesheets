"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "./ui";
import { errorMessageFromBody, readJsonResponse } from "@/lib/fetch-json";

type SiteNotificationItem = {
  id: string;
  title: string;
  message: string;
  meta: {
    workerNames?: string[];
    dateRange?: string;
    previousStatus?: string;
    newStatus?: string;
  } | null;
  read: boolean;
  createdAt: string;
};

export function LabourNotificationsWidget({ siteId }: { siteId: string }) {
  const [notifications, setNotifications] = useState<SiteNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    const res = await fetch(`/api/sites/${siteId}/notifications`);
    const json = await readJsonResponse<{
      notifications?: SiteNotificationItem[];
      unreadCount?: number;
      error?: string;
    }>(res);
    if (!res.ok) {
      setLoadError(errorMessageFromBody(json, "Failed to load notifications"));
      return;
    }
    if (json) {
      setNotifications(json.notifications ?? []);
      setUnreadCount(json.unreadCount ?? 0);
    }
  }, [siteId]);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(id: string) {
    await fetch(`/api/sites/${siteId}/notifications/${id}`, { method: "PATCH" });
    load();
  }

  if (loadError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <h2 className="mb-2 font-semibold text-ink">Labour notifications</h2>
        <p className="text-sm text-red-900">{loadError}</p>
      </Card>
    );
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <h2 className="mb-2 font-semibold text-ink">Labour notifications</h2>
        <p className="text-sm text-muted">No notifications.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-ink">Labour notifications</h2>
        {unreadCount > 0 && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
            {unreadCount} unread
          </span>
        )}
      </div>
      <ul className="divide-y divide-border-light">
        {notifications.map((n) => (
          <li key={n.id} className={`py-3 ${!n.read ? "bg-amber-50/50 -mx-4 px-4 rounded-lg" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">{n.title}</p>
                {n.meta?.workerNames && (
                  <p className="mt-0.5 text-xs text-muted">
                    {n.meta.workerNames.join(", ")}
                    {n.meta.dateRange ? ` · ${n.meta.dateRange}` : ""}
                    {n.meta.previousStatus && n.meta.newStatus
                      ? ` · ${n.meta.previousStatus} → ${n.meta.newStatus}`
                      : ""}
                  </p>
                )}
                <p className="mt-1 text-sm text-ink">{n.message}</p>
              </div>
              {!n.read && (
                <Button type="button" variant="ghost" size="sm" onClick={() => markRead(n.id)}>
                  Mark read
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
