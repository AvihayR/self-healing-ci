import { describe, expect, it } from "vitest";

import { formatMs, formatPercent, formatRelative, formatStatus } from "../src/lib/format.ts";

const NOW = Date.UTC(2026, 7, 29, 12, 0, 0);

describe("formatPercent", () => {
  it("shows an em dash for unmeasured", () => {
    expect(formatPercent(null)).toBe("—");
  });

  it("never renders unmeasured as a number", () => {
    expect(formatPercent(null)).not.toContain("100");
    expect(formatPercent(null)).not.toContain("0");
  });

  it("trims trailing zeros", () => {
    expect(formatPercent(100)).toBe("100%");
    expect(formatPercent(99.9)).toBe("99.9%");
    expect(formatPercent(99.999)).toBe("99.999%");
  });

  it("renders a total outage as zero, not as unmeasured", () => {
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("formatMs", () => {
  it("shows an em dash for no response", () => {
    expect(formatMs(null)).toBe("—");
  });

  it("uses milliseconds below a second", () => {
    expect(formatMs(42)).toBe("42 ms");
    expect(formatMs(999)).toBe("999 ms");
  });

  it("switches to seconds at a second", () => {
    expect(formatMs(1_000)).toBe("1.00 s");
    expect(formatMs(2_500)).toBe("2.50 s");
  });
});

describe("formatStatus", () => {
  it("distinguishes unknown from down", () => {
    expect(formatStatus(null)).toBe("unknown");
    expect(formatStatus(false)).toBe("down");
    expect(formatStatus(true)).toBe("up");
  });
});

describe("formatRelative", () => {
  it("says never when there is no check", () => {
    expect(formatRelative(null, NOW)).toBe("never");
  });

  it("collapses anything under a minute", () => {
    expect(formatRelative(NOW, NOW)).toBe("just now");
    expect(formatRelative(NOW - 59_000, NOW)).toBe("just now");
  });

  it("counts minutes, hours and days", () => {
    expect(formatRelative(NOW - 60_000, NOW)).toBe("1m ago");
    expect(formatRelative(NOW - 90 * 60_000, NOW)).toBe("1h ago");
    expect(formatRelative(NOW - 49 * 60 * 60_000, NOW)).toBe("2d ago");
  });

  it("does not render a clock-skewed future check as negative", () => {
    expect(formatRelative(NOW + 5_000, NOW)).toBe("just now");
  });
});
