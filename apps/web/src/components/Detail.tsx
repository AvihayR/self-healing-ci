import { useEffect, useState } from "react";

import type { History, MonitorStatus, Uptime, Window } from "../api-types.ts";
import { fetchHistory, fetchUptime } from "../lib/api.ts";
import { formatCount, formatMs, formatPercent, formatSpan } from "../lib/format.ts";
import { peakLatency } from "../lib/strip.ts";
import { LatencyPlot, Readout, Status } from "./primitives.tsx";

const WINDOWS: Window[] = ["24h", "7d", "30d"];

export function Detail({ monitor, onClose }: { monitor: MonitorStatus; onClose: () => void }) {
  const [window, setWindow] = useState<Window>("24h");
  const [history, setHistory] = useState<History | null>(null);
  const [uptime, setUptime] = useState<Uptime | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setHistory(null);
    setUptime(null);
    setFailed(false);

    Promise.all([
      fetchHistory(monitor.id, window, controller.signal),
      fetchUptime(monitor.id, window, controller.signal),
    ])
      .then(([nextHistory, nextUptime]) => {
        setHistory(nextHistory);
        setUptime(nextUptime);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });

    return () => controller.abort();
  }, [monitor.id, window]);

  const buckets = history?.buckets ?? [];
  const peak = peakLatency(buckets);
  const first = buckets[0];
  const last = buckets[buckets.length - 1];

  return (
    <section className="detail" aria-label={`${monitor.name} detail`}>
      <div className="detail-head">
        <div>
          <h2>{monitor.name}</h2>
          <span className="url">{monitor.url}</span>
        </div>
        <button type="button" className="close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="detail-body">
        <div className="windows" role="group" aria-label="Window">
          {WINDOWS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              aria-pressed={candidate === window}
              onClick={() => setWindow(candidate)}
            >
              {candidate}
            </button>
          ))}
        </div>

        {failed && <p className="detail-error">Could not load history for this window.</p>}

        {!failed && history === null && <div className="plot plot-pending" aria-label="Loading history" />}

        {!failed && history !== null && (
          <>
            <LatencyPlot buckets={buckets} draw />

            <div className="axis">
              <span>{first === undefined ? "—" : formatSpan(window)}</span>
              <span>peak p95 {formatMs(peak)}</span>
              <span>{last === undefined ? "—" : "now"}</span>
            </div>

            <div className="figures">
              <Readout
                label={`availability ${window}`}
                value={formatPercent(uptime?.percent ?? null)}
                tone={toneFor(uptime?.percent ?? null)}
              />
              <Readout label="checks" value={uptime === null ? "—" : formatCount(uptime.total)} />
              <Readout
                label="failed"
                value={uptime === null ? "—" : formatCount(uptime.failed)}
                {...(uptime !== null && uptime.failed > 0 ? { tone: "down" as const } : {})}
              />
              <Readout label="peak p95" value={formatMs(peak)} />
              <Readout label="current" value={<Status up={monitor.up} />} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function toneFor(percent: number | null): "up" | "down" | "unknown" | undefined {
  if (percent === null) return "unknown";
  return percent < 99 ? "down" : "up";
}
