# Canary — visual system

**Mode: Operate.** The visitor is reading an instrument and acting on it.

## The world

**Liquid glass.** Controls and content sit on translucent panels that blur, brighten and
saturate whatever passes beneath them, lit along their top edge as though by a light
source above. Depth comes from layering and refraction, not from drop shadows.

The rule that makes it a material rather than a decoration: **glass only ever floats over
something worth refracting.** A fixed ambient field of soft colour sits behind the whole
page, so every panel has real content beneath it to bend. Glass over a flat fill is just a
grey box, and that is the failure mode this system exists to avoid.

Both themes ship. Glass reads differently in each — dark leans on a light top edge against
a dim field, light leans on white translucency over colour — so each has its own tuned
tokens rather than one palette with inverted lightness.

## Colour

Tokens live in `apps/web/src/styles.css`, defined on `:root` and overridden under
`[data-theme="light"]`.

| Role | Token | Note |
|---|---|---|
| Ambient field | `--ambient-*` | Three radial washes behind everything. The thing glass refracts. |
| Glass fill | `--glass`, `--glass-strong` | Translucent white (light) or white-over-dark (dark). |
| Glass edge | `--edge`, `--edge-top` | `--edge-top` is brighter: the specular highlight that sells the material. |
| Text | `--text`, `--text-dim`, `--text-faint` | Three steps, each ≥4.5:1 on glass in both themes. |
| Up / Down / Warn / Unknown | `--up`, `--down`, `--warn`, `--unknown` | Status only. |
| Accent | `--accent` | Selection, focus, primary action. Never status. |

Status keeps its meaning-only discipline from the previous system. Glass adds surface
interest, which makes it *more* important that saturated colour stays reserved — a
translucent panel with a coloured glow behind every row would leave nothing for a real
outage to say.

## Depth

Four layers, and nothing invents a fifth:

1. Ambient field — fixed, never scrolls.
2. Page glass — the shell the content sits on.
3. Panel glass — summary, rows, detail.
4. Floating glass — command palette, popovers. Stronger blur, brighter edge.

Radii are concentric: a child's radius is the parent's minus its inset, so nested corners
stay parallel instead of drifting.

## Type

**IBM Plex**, self-hosted via Fontsource. Plex Sans for labels and prose, Plex Mono for
every measured value — this surface is measurement, and figures must align on the digit.
`tabular-nums` wherever a number can change.

## Time

**Asia/Jerusalem**, converted through `Intl.DateTimeFormat` and labelled with its real
abbreviation, which changes between IST and IDT across the year. The API remains epoch
milliseconds UTC end to end; conversion happens once, at the edge, in the formatter. The
old rule stands in stronger form: never imply a timezone that has not actually been
converted, and now that one is, say which.

## Motion

Motion carries state, and there is more of it than a plain instrument would want because
the surface is live: values transition when polling brings new numbers, rows settle when
filtering changes the set, panels lift on hover, the palette scales in from the caret.

- 140–220 ms for state feedback, exponential ease-out.
- One authored entrance: the tracks draw themselves once, on first paint.
- Everything above collapses to an instant state change under `prefers-reduced-motion`.

## Browser surfaces

Selection, caret, scrollbars and focus rings are themed per theme. On glass a default
focus ring disappears entirely, so focus is drawn as an accent ring plus a brightened
edge.

## Rules this system will not break

- No glass without an ambient field beneath it.
- Unmeasured renders as `—` in `--unknown`. Never `0`, never `100%`.
- No smooth interpolation between buckets.
- No coloured glow on anything that is not a status.
- The availability ramp describes a *track*, never a bucket. Passing buckets ramp
  along their track — toward a second green normally, toward red when that track
  contains a real outage — but the mix is capped so a passing hour never reads as a
  failing one, and buckets that actually failed keep their own colour on top.
- Text on glass is verified against the *composited* result, not against a token pair.
