import { useEffect, useRef, useState } from "react";

import { createMonitor } from "../lib/api.ts";

/**
 * Inline rather than a modal. Registering a URL needs neither interruption nor
 * protected focus, and the new row appearing directly beneath the form is
 * better feedback than a dialog dismissing over it.
 */
export function AddMonitor({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    first.current?.focus();
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedUrl = url.trim();
    const trimmedName = name.trim();
    if (trimmedName === "" || trimmedUrl === "") {
      setError("Both a name and a URL are needed.");
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setError("The URL has to start with http:// or https://");
      return;
    }

    setBusy(true);
    try {
      await createMonitor({ name: trimmedName, url: trimmedUrl });
      setName("");
      setUrl("");
      onAdded();
    } catch (cause) {
      setError(cause instanceof Error ? `Could not add it: ${cause.message}` : "Could not add it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="add-form" data-glass onSubmit={(event) => void submit(event)} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <div className="field">
        <label htmlFor="monitor-name">Name</label>
        <input
          id="monitor-name"
          ref={first}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="checkout api"
        />
      </div>

      <div className="field" style={{ flex: "2 1 18rem" }}>
        <label htmlFor="monitor-url">URL to watch</label>
        <input
          id="monitor-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://api.example.com/health"
          inputMode="url"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="control" data-variant="primary" disabled={busy}>
          {busy ? "Adding…" : "Add monitor"}
        </button>
        <button type="button" className="control" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {error !== null && <p className="form-error">{error}</p>}
    </form>
  );
}
