import { useEffect, useState } from "react";

import type { MonitorStatus } from "./api-types.ts";
import { formatMs, formatPercent, formatRelative, formatStatus } from "./lib/format.ts";

const API_BASE = import.meta.env["VITE_API_BASE"] ?? "";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; monitors: MonitorStatus[] };

export function App() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/monitors`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`api returned ${response.status}`);
        return (await response.json()) as MonitorStatus[];
      })
      .then((monitors) => setState({ kind: "ready", monitors }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>Canary</h1>
      <p className="sub">Uptime monitor — the application under test.</p>

      {state.kind === "loading" && <p>Loading…</p>}
      {state.kind === "error" && <p className="error">Could not reach the API: {state.message}</p>}
      {state.kind === "ready" && <MonitorTable monitors={state.monitors} />}
    </main>
  );
}

function MonitorTable({ monitors }: { monitors: MonitorStatus[] }) {
  if (monitors.length === 0) {
    return <p>No monitors registered yet.</p>;
  }

  const now = Date.now();
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>URL</th>
          <th>Status</th>
          <th>Last response</th>
          <th>Last checked</th>
        </tr>
      </thead>
      <tbody>
        {monitors.map((monitor) => (
          <tr key={monitor.id}>
            <td>{monitor.name}</td>
            <td className="url">{monitor.url}</td>
            <td className={`status status-${formatStatus(monitor.up)}`}>{formatStatus(monitor.up)}</td>
            <td>{formatMs(monitor.lastResponseMs)}</td>
            <td>{formatRelative(monitor.lastCheckedAt, now)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Re-exported so the availability formatter has a caller until the detail view lands. */
export { formatPercent };
