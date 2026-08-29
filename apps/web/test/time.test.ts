import { describe, expect, it } from "vitest";

import { formatClock, formatStamp, zoneLabel } from "../src/lib/time.ts";

/**
 * Israel switches to daylight time on the Friday before the last Sunday of
 * March and back on the last Sunday of October, so these two instants sit
 * firmly on either side of both transitions.
 */
const WINTER = Date.UTC(2026, 0, 15, 10, 0, 0); // 15 Jan 2026, 12:00 local (UTC+2)
const SUMMER = Date.UTC(2026, 6, 15, 10, 0, 0); // 15 Jul 2026, 13:00 local (UTC+3)

describe("zoneLabel", () => {
  it("is IST on standard time", () => {
    expect(zoneLabel(WINTER)).toBe("IST");
  });

  it("is IDT on daylight time", () => {
    expect(zoneLabel(SUMMER)).toBe("IDT");
  });

  it("never reports a raw GMT offset", () => {
    expect(zoneLabel(WINTER)).not.toContain("GMT");
    expect(zoneLabel(SUMMER)).not.toContain("GMT");
  });
});

describe("formatClock", () => {
  it("converts to Israel time rather than showing UTC", () => {
    // 10:00 UTC in January is 12:00 in Jerusalem.
    expect(formatClock(WINTER)).toBe("12:00:00 IST");
  });

  it("applies the daylight offset in summer", () => {
    // 10:00 UTC in July is 13:00 in Jerusalem.
    expect(formatClock(SUMMER)).toBe("13:00:00 IDT");
  });

  it("pads to a stable width so the clock does not jitter", () => {
    const early = Date.UTC(2026, 0, 15, 6, 5, 4);
    expect(formatClock(early)).toBe("08:05:04 IST");
  });
});

describe("formatStamp", () => {
  it("renders a short local date and time", () => {
    expect(formatStamp(WINTER)).toBe("15 Jan 12:00");
  });

  it("uses the local day, which can differ from the UTC day", () => {
    // 22:30 UTC on 14 Jan is 00:30 on 15 Jan in Jerusalem.
    expect(formatStamp(Date.UTC(2026, 0, 14, 22, 30))).toBe("15 Jan 00:30");
  });
});
