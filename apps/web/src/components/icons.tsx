/**
 * Authored SVG at one stroke weight. Not emoji: an icon system needs a
 * consistent optical weight, and platform emoji render differently on every
 * machine the dashboard is shown on.
 */

const base = { className: "icon", viewBox: "0 0 24 24", "aria-hidden": true } as const;

export function SearchIcon() {
  return (
    <svg {...base}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg {...base}>
      <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4a8.3 8.3 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...base}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...base}>
      <path d="M4 7h16M10 7V5h4v2M6 7l1 12h10l1-12M10 11v5M14 11v5" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg {...base}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
