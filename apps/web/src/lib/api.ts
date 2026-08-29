import type { History, MonitorStatus, Uptime, Window } from "../api-types.ts";

const BASE = import.meta.env["VITE_API_BASE"] ?? "";

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE}${path}`, signal ? { signal } : {});
  if (!response.ok) {
    throw new Error(`${path} responded ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchMonitors(signal?: AbortSignal): Promise<MonitorStatus[]> {
  return get<MonitorStatus[]>("/monitors", signal);
}

export function fetchHistory(id: string, window: Window, signal?: AbortSignal): Promise<History> {
  return get<History>(`/monitors/${id}/history?window=${window}`, signal);
}

export function fetchUptime(id: string, window: Window, signal?: AbortSignal): Promise<Uptime> {
  return get<Uptime>(`/monitors/${id}/uptime?window=${window}`, signal);
}
