import type { LabourRequestStatus } from "./labour-types";
import { formatDateRangeDisplay } from "./labour-dates";

export function labourUpdateNotificationContent(changes: string[]): {
  type: string;
  title: string;
  message: string;
} {
  return {
    type: "LABOUR_REQUEST_UPDATED",
    title: "Labour booking updated",
    message: changes.join(". ") + (changes.length ? "." : ""),
  };
}

export function labourStatusNotificationContent(
  status: LabourRequestStatus,
  message?: string | null
): { type: string; title: string; message: string } {
  switch (status) {
    case "ACCEPTED":
      return {
        type: "LABOUR_REQUEST_ACCEPTED",
        title: "Labour request accepted",
        message: message?.trim() || "Your labour request has been accepted.",
      };
    case "DENIED":
      return {
        type: "LABOUR_REQUEST_DENIED",
        title: "Labour request denied",
        message: message?.trim() || "Your labour request has been denied.",
      };
    case "PENDING":
      return {
        type: "LABOUR_REQUEST_PENDING",
        title: "Labour request pending",
        message: message?.trim() || "Your labour request is awaiting approval.",
      };
    case "CANCELLED":
      return {
        type: "LABOUR_REQUEST_CANCELLED",
        title: "Labour request cancelled",
        message: message?.trim() || "Your labour request has been cancelled.",
      };
  }
}

export function labourNotificationMeta(input: {
  labourRequestId: string;
  workerNames: string[];
  dates: string[];
  previousStatus?: LabourRequestStatus;
  newStatus?: LabourRequestStatus;
  previousHours?: number;
  newHours?: number;
  previousDates?: string[];
}) {
  return {
    labourRequestId: input.labourRequestId,
    workerNames: input.workerNames,
    dates: input.dates,
    dateRange: formatDateRangeDisplay(input.dates),
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    previousHours: input.previousHours,
    newHours: input.newHours,
    previousDateRange: input.previousDates
      ? formatDateRangeDisplay(input.previousDates)
      : undefined,
  };
}
