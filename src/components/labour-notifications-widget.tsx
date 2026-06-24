"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button, Card } from "./ui";
import { errorMessageFromBody, readJsonResponse } from "@/lib/fetch-json";

const VISIBLE_COUNT = 3;

type SiteNotificationItem = {
  id: string;
  title: string;
  message: string;
  meta: {
    workerNames?: string[];
    dateRange?: string;
    previousDateRange?: string;
    previousStatus?: string;
    newStatus?: string;
    previousHours?: number;
    newHours?: number;
  } | null;
  read: boolean;
  createdAt: string;
};

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: SiteNotificationItem;
  onMarkRead: (id: string) => void;
}) {
  const n = notification;

  return (
    <li className={`py-3 ${!n.read ? "rounded-lg bg-amber-50/50 -mx-4 px-4" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink">{n.title}</p>
          {n.meta?.workerNames && (
            <p className="mt-0.5 text-xs text-muted">
              {n.meta.workerNames.join(", ")}
              {n.meta.previousDateRange && n.meta.dateRange
                ? ` · ${n.meta.previousDateRange} → ${n.meta.dateRange}`
                : n.meta.dateRange
                  ? ` · ${n.meta.dateRange}`
                  : ""}
              {n.meta.previousHours != null && n.meta.newHours != null
                ? ` · ${n.meta.previousHours}h → ${n.meta.newHours}h/day`
                : ""}
              {n.meta.previousStatus && n.meta.newStatus
                ? ` · ${n.meta.previousStatus} → ${n.meta.newStatus}`
                : ""}
            </p>
          )}
          <p className="mt-1 text-sm text-ink">{n.message}</p>
        </div>
        {!n.read && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onMarkRead(n.id)}>
            Mark read
          </Button>
        )}
      </div>
    </li>
  );
}

export function LabourNotificationsWidget({ siteId }: { siteId: string }) {
  const [notifications, setNotifications] = useState<SiteNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [showOlder, setShowOlder] = useState(false);

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

  const recent = notifications.slice(0, VISIBLE_COUNT);
  const older = notifications.slice(VISIBLE_COUNT);
  const hasOlder = older.length > 0;

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
        {recent.map((n) => (
          <NotificationRow key={n.id} notification={n} onMarkRead={markRead} />
        ))}
      </ul>

      {hasOlder && (
        <div className="mt-2 border-t border-border-light pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-between"
            aria-expanded={showOlder}
            onClick={() => setShowOlder((open) => !open)}
          >
            <span>
              {showOlder
                ? "Hide older notifications"
                : `Show ${older.length} older notification${older.length === 1 ? "" : "s"}`}
            </span>
            {showOlder ? (
              <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
            )}
          </Button>

          {showOlder && (
            <ul className="mt-1 divide-y divide-border-light">
              {older.map((n) => (
                <NotificationRow key={n.id} notification={n} onMarkRead={markRead} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
