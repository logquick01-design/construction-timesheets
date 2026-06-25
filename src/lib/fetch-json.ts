export async function readJsonResponse<T>(res: Response): Promise<T | null> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function errorMessageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const message = (body as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export function errorMessageFromResponse(res: Response, body: unknown, fallback: string): string {
  if (!res.ok && body == null) {
    if (res.status >= 500) {
      return "Server error — try restarting the dev server (rm -rf .next && npm run dev)";
    }
    return fallback;
  }
  return errorMessageFromBody(body, fallback);
}

export function asWorkerList(body: unknown): body is Array<{
  id: string;
  name: string;
  trade: string;
  personId?: string | null;
  company: { id: string; name: string } | null;
}> {
  return Array.isArray(body);
}
