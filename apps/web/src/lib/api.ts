import type { CreateMonitor, History, Monitor, MonitorStatus, Uptime, Window } from "../api-types.ts";

const BASE = import.meta.env["VITE_API_BASE"] ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init);
  if (!response.ok) {
    let detail = `${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error !== undefined) detail = body.error;
    } catch {
      // Not every failure has a JSON body; the status is enough.
    }
    throw new Error(detail);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export function fetchMonitors(signal?: AbortSignal): Promise<MonitorStatus[]> {
  return request<MonitorStatus[]>("/monitors", signal ? { signal } : {});
}

export function fetchHistory(id: string, window: Window, signal?: AbortSignal): Promise<History> {
  return request<History>(`/monitors/${id}/history?window=${window}`, signal ? { signal } : {});
}

export function fetchUptime(id: string, window: Window, signal?: AbortSignal): Promise<Uptime> {
  return request<Uptime>(`/monitors/${id}/uptime?window=${window}`, signal ? { signal } : {});
}

export function createMonitor(input: CreateMonitor): Promise<Monitor> {
  return request<Monitor>("/monitors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteMonitor(id: string): Promise<void> {
  return request<void>(`/monitors/${id}`, { method: "DELETE" });
}
