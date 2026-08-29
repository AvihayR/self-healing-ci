/**
 * Presentation helpers. Pure and tested, because "99.9%" appearing where the
 * data says "unmeasured" is the kind of bug that survives a demo.
 */

/** Availability for display. Null means unmeasured, and must not read as perfect. */
export function formatPercent(percent: number | null): string {
  if (percent === null) return "—";
  return `${percent.toFixed(3).replace(/\.?0+$/, "")}%`;
}

export function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  return `${(ms / 1_000).toFixed(2)} s`;
}

export function formatStatus(up: boolean | null): "up" | "down" | "unknown" {
  if (up === null) return "unknown";
  return up ? "up" : "down";
}

/** Coarse relative time. Deliberately coarse: a monitor list does not need seconds. */
export function formatRelative(at: number | null, now: number): string {
  if (at === null) return "never";
  const deltaMs = now - at;
  if (deltaMs < 0) return "just now";

  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

/** A UTC clock reading. Never local: nothing here has converted a timezone. */
export function formatClock(at: number): string {
  const date = new Date(at);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} UTC`;
}

/** How far back a window reaches, for the left end of a chart axis. */
export function formatSpan(window: "24h" | "7d" | "30d"): string {
  return window === "24h" ? "24 hours ago" : window === "7d" ? "7 days ago" : "30 days ago";
}

/** Integers with thin separators, tabular-safe. */
export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}
