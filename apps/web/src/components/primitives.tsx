import type { ReactNode } from "react";

import type { Bucket } from "../api-types.ts";
import { formatStatus } from "../lib/format.ts";
import { barHeight, bucketState, peakLatency } from "../lib/strip.ts";

export function Status({ up }: { up: boolean | null }) {
  const state = formatStatus(up);
  return (
    <span className="status" data-state={state}>
      <span className="dot" aria-hidden="true" />
      {state}
    </span>
  );
}

export function Readout({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: ReactNode;
  unit?: string | undefined;
  tone?: "up" | "down" | "unknown" | undefined;
}) {
  return (
    <div className="readout">
      <span className="label">{label}</span>
      <span className="value" {...(tone ? { "data-tone": tone } : {})}>
        {value}
        {unit !== undefined && <span className="unit">{unit}</span>}
      </span>
    </div>
  );
}

/**
 * The availability track in a row: one full-height bar per bucket, coloured by
 * that bucket's state.
 *
 * Uniform height on purpose. A row's job is to make a bad period impossible to
 * miss at a glance, and encoding latency here as well would mean a monitor with
 * low variance renders as a flat wall while a red bucket has to compete with
 * height noise for attention.
 */
export function UptimeTrack({ buckets, draw }: { buckets: readonly Bucket[]; draw: boolean }) {
  if (buckets.length === 0) {
    return <div className="track track-void" aria-hidden="true" />;
  }
  return (
    <div className="track" data-draw={draw ? "true" : "false"} aria-hidden="true">
      {buckets.map((bucket, index) => (
        <span
          key={bucket.start}
          className="tick"
          data-state={bucketState(bucket)}
          style={draw ? { animationDelay: `${Math.min(index * 5, 260)}ms` } : undefined}
          title={describeBucket(bucket)}
        />
      ))}
    </div>
  );
}

/**
 * The latency plot in the detail panel: one bar per bucket, height from p95.
 * Discrete because the data is discrete — interpolating into a curve would
 * assert continuity the probe never measured.
 */
export function LatencyPlot({ buckets, draw }: { buckets: readonly Bucket[]; draw: boolean }) {
  const peak = peakLatency(buckets);
  return (
    <div className="plot" data-draw={draw ? "true" : "false"}>
      {buckets.map((bucket, index) => (
        <span
          key={bucket.start}
          className="bar"
          data-state={bucketState(bucket)}
          style={{
            height: `${barHeight(bucket, peak)}%`,
            ...(draw ? { animationDelay: `${Math.min(index * 6, 300)}ms` } : {}),
          }}
          title={describeBucket(bucket)}
        />
      ))}
    </div>
  );
}

export function describeBucket(bucket: Bucket): string {
  if (bucket.total === 0) return "no checks";
  const failed = bucket.total - bucket.ok;
  const latency = bucket.p95 === null ? "no response" : `p95 ${bucket.p95} ms`;
  return `${bucket.total} checks · ${failed} failed · ${latency}`;
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <tbody>
      {Array.from({ length: count }, (_unused, index) => (
        <tr key={index}>
          <td>
            <div className="cell-name">
              <span className="skeleton" style={{ width: "9rem" }} />
              <span className="skeleton" style={{ width: "14rem", height: "0.65em" }} />
            </div>
          </td>
          <td>
            <span className="skeleton" style={{ width: "4.5rem", display: "block" }} />
          </td>
          <td className="optional">
            <span className="skeleton" style={{ width: "100%", height: "1.5rem", display: "block" }} />
          </td>
          <td className="num">
            <span className="skeleton" style={{ width: "3.5rem", marginLeft: "auto", display: "block" }} />
          </td>
          <td className="num optional">
            <span className="skeleton" style={{ width: "4rem", marginLeft: "auto", display: "block" }} />
          </td>
        </tr>
      ))}
    </tbody>
  );
}
