import { useCallback, useEffect, useMemo, useState } from "react";

import type { Bucket, MonitorStatus } from "./api-types.ts";
import { Detail } from "./components/Detail.tsx";
import { Readout, SkeletonRows, Status, UptimeTrack } from "./components/primitives.tsx";
import { fetchHistory, fetchMonitors } from "./lib/api.ts";
import { formatClock, formatCount, formatMs, formatPercent, formatRelative } from "./lib/format.ts";
import { useFirstPaint } from "./lib/useFirstPaint.ts";

interface Loaded {
  monitors: MonitorStatus[];
  strips: Record<string, Bucket[]>;
  at: number;
}

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: Loaded };

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [selected, setSelected] = useState<string | null>(null);
  const firstPaint = useFirstPaint();

  const load = useCallback(async (signal: AbortSignal) => {
    const monitors = await fetchMonitors(signal);
    const histories = await Promise.all(
      monitors.map(async (monitor) => {
        try {
          const history = await fetchHistory(monitor.id, "24h", signal);
          return [monitor.id, history.buckets] as const;
        } catch {
          return [monitor.id, [] as Bucket[]] as const;
        }
      }),
    );
    return { monitors, strips: Object.fromEntries(histories), at: Date.now() };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((data) => setState({ kind: "ready", data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, [load]);

  const data = state.kind === "ready" ? state.data : null;
  const fleet = useMemo(() => summarise(data?.monitors ?? []), [data]);
  const active = data?.monitors.find((monitor) => monitor.id === selected) ?? null;

  return (
    <div className="shell">
      <header className="masthead">
        <h1 className="wordmark">
          <span className="glyph">Canary</span>
          <span className="tag">uptime monitor</span>
        </h1>
        <span className="clock">
          <span className="live" aria-hidden="true" />
          {data === null ? "connecting" : formatClock(data.at)}
        </span>
      </header>

      <section className="summary" aria-label="Fleet summary">
        <Readout label="monitors" value={data === null ? "—" : formatCount(fleet.total)} />
        <Readout
          label="up"
          value={data === null ? "—" : formatCount(fleet.up)}
          {...(fleet.up > 0 ? { tone: "up" as const } : {})}
        />
        <Readout
          label="down"
          value={data === null ? "—" : formatCount(fleet.down)}
          {...(fleet.down > 0 ? { tone: "down" as const } : {})}
        />
        <Readout
          label="unmeasured"
          value={data === null ? "—" : formatCount(fleet.unknown)}
          {...(fleet.unknown > 0 ? { tone: "unknown" as const } : {})}
        />
        <Readout
          label="slowest response"
          value={data === null ? "—" : formatMs(fleet.slowest)}
        />
      </section>

      {state.kind === "error" && (
        <div className="notice" data-tone="error">
          <h2>The API is not answering</h2>
          <p>
            {state.message}. Start it with <code>npm run dev:api</code> — the dashboard reads{" "}
            <code>/monitors</code> through the dev-server proxy on the same origin.
          </p>
        </div>
      )}

      {state.kind !== "error" && (
        <table className="rows">
          <thead>
            <tr>
              <th scope="col">Monitor</th>
              <th scope="col">Status</th>
              <th scope="col" className="optional">
                Last 24 hours
              </th>
              <th scope="col" className="num">
                Response
              </th>
              <th scope="col" className="num optional">
                Checked
              </th>
            </tr>
          </thead>

          {state.kind === "loading" ? (
            <SkeletonRows />
          ) : (
            <tbody>
              {state.data.monitors.map((monitor) => (
                <tr
                  key={monitor.id}
                  tabIndex={0}
                  aria-selected={monitor.id === selected}
                  onClick={() => setSelected(monitor.id === selected ? null : monitor.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(monitor.id === selected ? null : monitor.id);
                    }
                  }}
                >
                  <td>
                    <div className="cell-name">
                      <span className="name">{monitor.name}</span>
                      <span className="url">{monitor.url}</span>
                    </div>
                  </td>
                  <td>
                    <Status up={monitor.up} />
                  </td>
                  <td className="optional">
                    <UptimeTrack buckets={state.data.strips[monitor.id] ?? []} draw={firstPaint} />
                  </td>
                  <td className="num">{formatMs(monitor.lastResponseMs)}</td>
                  <td className="num optional">{formatRelative(monitor.lastCheckedAt, state.data.at)}</td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      )}

      {state.kind === "ready" && state.data.monitors.length === 0 && (
        <div className="notice">
          <h2>Nothing is being watched yet</h2>
          <p>
            Register a URL and Canary starts probing it. Until a probe runs, availability reads{" "}
            <code>—</code> rather than 100% — unmeasured is not the same as healthy.
          </p>
        </div>
      )}

      {active !== null && <Detail monitor={active} onClose={() => setSelected(null)} />}
    </div>
  );
}

function summarise(monitors: readonly MonitorStatus[]) {
  let up = 0;
  let down = 0;
  let unknown = 0;
  let slowest: number | null = null;

  for (const monitor of monitors) {
    if (monitor.up === null) unknown += 1;
    else if (monitor.up) up += 1;
    else down += 1;

    if (monitor.lastResponseMs !== null && (slowest === null || monitor.lastResponseMs > slowest)) {
      slowest = monitor.lastResponseMs;
    }
  }

  return { total: monitors.length, up, down, unknown, slowest };
}

export { formatPercent };
