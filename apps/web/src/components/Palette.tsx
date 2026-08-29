import { useEffect, useRef, useState } from "react";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

/**
 * ⌘K palette in a native `<dialog>`.
 *
 * `<dialog>` rather than a positioned div so the overlay escapes every
 * container, gets focus trapping and Escape-to-close from the platform, and
 * paints on the top layer above the blurred panels rather than fighting them
 * for stacking context.
 */
export function Palette({
  open,
  commands,
  onClose,
}: {
  open: boolean;
  commands: Command[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) {
      setQuery("");
      setActive(0);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const matches = commands.filter((command) =>
    command.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    setActive(0);
  }, [query]);

  return (
    <dialog
      className="palette"
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-label="Command palette"
    >
      <input
        className="palette-input"
        placeholder="Search monitors and commands…"
        value={query}
        autoFocus
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(index + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            const chosen = matches[active];
            if (chosen !== undefined) {
              chosen.run();
              onClose();
            }
          }
        }}
      />

      {matches.length === 0 ? (
        <p className="palette-empty">Nothing matches “{query}”.</p>
      ) : (
        <ul className="palette-list">
          {matches.map((command, index) => (
            <li key={command.id}>
              <button
                type="button"
                className="palette-item"
                data-active={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => {
                  command.run();
                  onClose();
                }}
              >
                <span>{command.label}</span>
                {command.hint !== undefined && <span className="hint">{command.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}
