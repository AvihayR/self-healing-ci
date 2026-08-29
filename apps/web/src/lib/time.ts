/**
 * Israel time.
 *
 * The API is epoch milliseconds UTC end to end; conversion happens here and
 * nowhere else. `Asia/Jerusalem` rather than a fixed +02:00 or +03:00, because
 * Israel observes DST and a hardcoded offset would be silently wrong for about
 * half the year. The abbreviation is read back from the formatter rather than
 * assumed, so it says IST in winter and IDT in summer without being told.
 */

export const ZONE = "Asia/Jerusalem";

const clockFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const stampFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const offsetFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  timeZoneName: "longOffset",
});

/**
 * The zone's current abbreviation — IST in winter, IDT in summer.
 *
 * Derived from the offset rather than read from `timeZoneName: "short"`, which
 * returns "GMT+3" for this zone in English locales. The offset itself is the
 * fact: Israel is UTC+02:00 on standard time and UTC+03:00 on daylight time,
 * and the formatter knows which applies on any given date.
 */
export function zoneLabel(at: number): string {
  const offset = offsetFormat.formatToParts(at).find((piece) => piece.type === "timeZoneName");
  return offset?.value.includes("+03") === true ? "IDT" : "IST";
}

/** `18:42:07 IDT` */
export function formatClock(at: number): string {
  return `${clockFormat.format(at)} ${zoneLabel(at)}`;
}

/** `29 Aug 18:42` */
export function formatStamp(at: number): string {
  return stampFormat.format(at).replace(",", "");
}
