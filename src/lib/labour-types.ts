export type LabourRequestStatus = "PENDING" | "ACCEPTED" | "DENIED" | "CANCELLED";

export const LABOUR_REQUEST_STATUSES: LabourRequestStatus[] = [
  "PENDING",
  "ACCEPTED",
  "DENIED",
  "CANCELLED",
];

export function isLabourRequestStatus(value: string): value is LabourRequestStatus {
  return LABOUR_REQUEST_STATUSES.includes(value as LabourRequestStatus);
}

export function canCancelLabourRequest(status: LabourRequestStatus): boolean {
  return status === "PENDING" || status === "ACCEPTED";
}
