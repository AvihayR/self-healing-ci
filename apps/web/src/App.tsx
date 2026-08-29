import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Bucket, MonitorStatus } from "./api-types.ts";
import { AddMonitor } from "./components/AddMonitor.tsx";
import { Detail } from "./components/Detail.tsx";
import { MoonIcon, PlusIcon, SearchIcon, SunIcon, TrashIcon } from "./components/icons.tsx";
import { Palette, type Command } from "./components/Palette.tsx";
import { SkeletonRows, Status, UptimeTrack } from "./components/primitives.tsx";
import { deleteMonitor, fetchHistory, fetchMonitors } from "./lib/api.ts";
import { formatCount, formatMs, formatRelative, formatStatus } from "./lib/format.ts";
import { useTheme } from "./lib/theme.ts";
import { formatClock } from "./lib/time.ts";

const REFRESH_MS = 15_000;

type Filter = "all" | "up" | "down" | "unknown";

interface Snapshot {
  monitors: MonitorStatus[];
  tracks: Record<string, Bucket[]>;
  at: number;
}

export function App() {
  const [theme, toggleTheme] = useTheme();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [firstPaint, setFirstPaint] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (signal?: AbortSignal): Promise<Snapshot> => {
    const monitors = await fetchMonitors(signal);
    const tracks = await Promise.all(
      monitors.map(async (monitor) => {
        try {
          const history = await fetchHistory(monitor.id, "24h", signal);
          return [monitor.id, history.buckets] as const;
        } catch {
          return [monitor.id, [] as Bucket[]] as const;
        }
      }),
    );
    return { monitors, tracks: Object.fromEntries(tracks), at: Date.now() };
  }, []);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setSnapshot(await load(signal));
        setError(null);
      } catch (cause) {
        if (signal?.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [load],
  );

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setTimeout(() => setFirstPaint(false), 1200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [refresh]);

  // Live polling. Paused while the tab is hidden — a background tab does not
  // need fresh numbers, and waking every 15s to render nobody is watching is
  // just battery.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      } else if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const monitors = snapshot?.monitors ?? [];
  const fleet = useMemo(() => summarise(monitors), [monitors]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return monitors.filter((monitor) => {
      if (filter !== "all" && formatStatus(monitor.up) !== filter) return false;
      if (needle === "") return true;
      return (
        monitor.name.toLowerCase().includes(needle) || monitor.url.toLowerCase().includes(needle)
      );
    });
  }, [monitors, query, filter]);

  const active = monitors.find((monitor) => monitor.id === selected) ?? null;

  async function remove(monitor: MonitorStatus) {
    if (!window.confirm(`Stop watching “${monitor.name}”? Its history is discarded.`)) return;
    await deleteMonitor(monitor.id);
    if (selected === monitor.id) setSelected(null);
    await refresh();
  }

  const commands: Command[] = [
    { id: "add", label: "Add a monitor", hint: "new", run: () => setAdding(true) },
    {
      id: "theme",
      label: theme === "dark" ? "Switch to day mode" : "Switch to night mode",
      hint: "theme",
      run: toggleTheme,
    },
    { id: "help", label: "How this works", hint: "help", run: () => setHelpOpen(true) },
    { id: "refresh", label: "Refresh now", hint: "reload", run: () => void refresh() },
    ...(["all", "up", "down", "unknown"] as Filter[]).map((option) => ({
      id: `filter-${option}`,
      label: `Show ${option === "all" ? "all monitors" : option}`,
      hint: "filter",
      run: () => setFilter(option),
    })),
    ...monitors.map((monitor) => ({
      id: monitor.id,
      label: monitor.name,
      hint: formatStatus(monitor.up),
      run: () => setSelected(monitor.id),
    })),
  ];

  return (
    <>
      <div className="ambient" aria-hidden="true" />

      <div className="shell">
        <header className="masthead glass">
          <h1 className="wordmark">
            <span className="glyph">Canary</span>
            <span className="tag">uptime monitor</span>
          </h1>

          <div className="masthead-tools">
            <div className="search">
              <SearchIcon />
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder="Search monitors…"
                aria-label="Search monitors"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <button type="button" className="control" onClick={() => setPaletteOpen(true)}>
              <kbd>⌘K</kbd>
            </button>

            <button
              type="button"
              className="control"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to day mode" : "Switch to night mode"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            <button
              type="button"
              className="control"
              data-variant="primary"
              onClick={() => setAdding((open) => !open)}
            >
              <PlusIcon />
              Add
            </button>

            <span className="clock">
              <span className="live" aria-hidden="true" />
              {snapshot === null ? "connecting" : formatClock(snapshot.at)}
            </span>
          </div>
        </header>

        {helpOpen && (
          <section className="notice">
            <h2>What this is</h2>
            <p>
              Canary watches URLs and tells you whether they answer. It is the application that
              the self-healing CI pipeline breaks on purpose, so it is deliberately small.
            </p>
            <ol>
              <li>
                <b>Add</b> a URL to watch. It appears in the list straight away.
              </li>
              <li>
                A probe checks it on a schedule and records whether it answered and how long it
                took. Until a probe has run, status reads <code>unknown</code> — unmeasured is not
                the same as healthy.
              </li>
              <li>
                Each row shows the last 24 hours as one bar per hour: green means every check
                passed, amber means some failed, red means all of them did.
              </li>
              <li>
                <b>Click a row</b> for response-time history and availability over 24 hours, 7 days
                or 30 days.
              </li>
            </ol>
            <p>
              <button type="button" className="control" onClick={() => setHelpOpen(false)}>
                Got it
              </button>
            </p>
          </section>
        )}

        {adding && (
          <AddMonitor
            onAdded={() => {
              setAdding(false);
              void refresh();
            }}
            onCancel={() => setAdding(false)}
          />
        )}

        <section className="summary" aria-label="Fleet summary">
          <Stat label="monitors" value={snapshot === null ? "—" : formatCount(fleet.total)} />
          <Stat
            label="up"
            value={snapshot === null ? "—" : formatCount(fleet.up)}
            tone={fleet.up > 0 ? "up" : undefined}
          />
          <Stat
            label="down"
            value={snapshot === null ? "—" : formatCount(fleet.down)}
            tone={fleet.down > 0 ? "down" : undefined}
          />
          <Stat
            label="unmeasured"
            value={snapshot === null ? "—" : formatCount(fleet.unknown)}
            tone={fleet.unknown > 0 ? "unknown" : undefined}
          />
          <Stat label="slowest" value={snapshot === null ? "—" : formatMs(fleet.slowest)} />
        </section>

        {error !== null && (
          <div className="notice" data-tone="error">
            <h2>The API is not answering</h2>
            <p>
              {error}. Start it with <code>npm run dev:api</code> — the dashboard reads{" "}
              <code>/monitors</code> through the dev-server proxy on the same origin.
            </p>
          </div>
        )}

        {error === null && monitors.length > 0 && (
          <div className="filters">
            {(["all", "up", "down", "unknown"] as Filter[]).map((option) => (
              <button
                key={option}
                type="button"
                className="chip"
                aria-pressed={filter === option}
                onClick={() => setFilter(option)}
              >
                {option === "unknown" ? "unmeasured" : option}
              </button>
            ))}
            <span className="result-count">
              {visible.length} of {monitors.length}
            </span>
          </div>
        )}

        {snapshot === null && error === null && <SkeletonRows />}

        {visible.length > 0 && (
          <ul className="list">
            {visible.map((monitor, index) => (
              <li key={monitor.id}>
                <div
                  className="row"
                  role="button"
                  tabIndex={0}
                  aria-expanded={monitor.id === selected}
                  style={firstPaint ? { animationDelay: `${Math.min(index * 45, 320)}ms` } : undefined}
                  onClick={() => setSelected(monitor.id === selected ? null : monitor.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelected(monitor.id === selected ? null : monitor.id);
                    }
                  }}
                >
                  <div className="cell-name">
                    <span className="name">{monitor.name}</span>
                    <span className="url">{monitor.url}</span>
                  </div>

                  <div className="status-cell">
                    <Status up={monitor.up} />
                  </div>

                  <div className="optional">
                    <UptimeTrack buckets={snapshot?.tracks[monitor.id] ?? []} draw={firstPaint} />
                  </div>

                  <div className="cell-num">{formatMs(monitor.lastResponseMs)}</div>

                  <div className="cell-num optional">
                    {formatRelative(monitor.lastCheckedAt, snapshot?.at ?? Date.now())}
                  </div>

                  <button
                    type="button"
                    className="row-remove"
                    aria-label={`Stop watching ${monitor.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void remove(monitor);
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {snapshot !== null && monitors.length === 0 && !adding && (
          <section className="notice">
            <h2>Nothing is being watched yet</h2>
            <p>
              Add a URL and Canary starts probing it on a schedule, recording whether it answered
              and how long it took.
            </p>
            <p>
              Until the first probe runs, availability reads <code>—</code> rather than 100%.
              Unmeasured is not the same as healthy, and this dashboard will never pretend
              otherwise.
            </p>
            <p>
              <button type="button" className="control" data-variant="primary" onClick={() => setAdding(true)}>
                <PlusIcon />
                Add your first monitor
              </button>
            </p>
          </section>
        )}

        {snapshot !== null && monitors.length > 0 && visible.length === 0 && (
          <section className="notice">
            <h2>No monitors match</h2>
            <p>
              Nothing here is named or pointed at “{query}”
              {filter !== "all" && ` with status ${filter}`}.
            </p>
            <p>
              <button
                type="button"
                className="control"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear search and filters
              </button>
            </p>
          </section>
        )}

        {active !== null && <Detail monitor={active} onClose={() => setSelected(null)} />}
      </div>

      <Palette open={paletteOpen} commands={commands} onClose={() => setPaletteOpen(false)} />
    </>
  );
}

/** A summary figure that flashes when polling brings it a new value. */
function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "unknown" | undefined;
}) {
  const previous = useRef(value);
  const changed = previous.current !== value;
  useEffect(() => {
    previous.current = value;
  }, [value]);

  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span
        className="value"
        key={value}
        data-changed={changed ? "true" : "false"}
        {...(tone ? { "data-tone": tone } : {})}
      >
        {value}
      </span>
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
