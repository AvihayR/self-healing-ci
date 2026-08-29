# Canary — visual system

**Mode: Operate.** The visitor is reading an instrument.

## The world

**A calibrated readout**, not a dashboard. The reference is a chart recorder or a bench
instrument: a dark ground, hairline rules, exact alignment, and numbers set in a face that
was drawn for measurement. Trust comes from precision and restraint, not from decoration.

The consequence that matters most: **saturated colour appears only where it carries
meaning.** Up, down and unknown are the only things allowed to be vivid. Nothing else on
the surface competes with them, so a red row is visible in peripheral vision and from the
back of a room. A dashboard that also had a purple gradient header would be lying about
what is important.

Dark, and committed rather than theme-toggled. The surface is shown to people; a single
sharply-tuned world beats two adequate ones.

## Colour

Tokens live in `apps/web/src/styles.css` on `:root`. OKLCH throughout, so that lightness
steps are perceptually even rather than nominally even.

| Role | Token | Note |
|---|---|---|
| Ground | `--ground` | Near-black, faintly cool. Not `#000` — pure black leaves no room beneath the panels. |
| Panel | `--panel`, `--panel-raised` | Two steps up from ground. |
| Rule | `--rule`, `--rule-strong` | Hairlines. The primary structural device; boxes and shadows are not. |
| Text | `--text`, `--text-dim`, `--text-faint` | Three steps. `--text-faint` is for units and axis labels only. |
| Up | `--up` | Measured green. Legible at distance, not neon. |
| Down | `--down` | Red, the loudest value in the system. |
| Unknown | `--unknown` | Deliberately inert. Unmeasured must never look like a state. |
| Accent | `--accent` | Cyan. Selection, focus and interactive affordance only — never status, never decoration. |

Three meaning hues and one interaction hue is the ceiling. Adding a fourth would mean
status had stopped being the loudest thing on the page.

## Type

**IBM Plex**, self-hosted through Fontsource so the build stays offline and CI-safe.
Chosen for engineering character rather than neutrality; its flared stems and distinctive
`a` and `g` keep the surface from reading as a generic admin template.

- **Plex Sans Variable** — labels, prose, headings.
- **Plex Mono** — every measured value: milliseconds, percentages, counts, timestamps,
  URLs. Monospace here is earned rather than costume: this surface is measurement, and
  columns of figures must align on the digit.
- `font-variant-numeric: tabular-nums` wherever numbers can change, so a value updating
  never shifts the layout beside it.
- Fixed rem scale, ratio ~1.2. No fluid clamp sizing: users read this at a consistent DPI
  and a heading that shrinks inside a panel looks worse, not responsive.

## Composition

**The strip chart is the hero.** Each monitor's history renders as one bar per bucket —
discrete, because the data is discrete. Bar height is p95 latency; bar colour is that
bucket's availability. A failed bucket is full-height red. This is legible across a room
and exact under inspection, and it visualises the `bucketize` output directly rather than
smoothing it into a curve the data does not support.

Layout is a masthead, a summary rule, and a table. Not cards: same-size cards would give
every monitor equal visual weight, which is precisely wrong for a surface whose job is
making one failing row obvious.

Selecting a row opens a detail panel with the three windows and the availability readout.

## Motion

One authored moment: on first load the strip-chart bars rise from the baseline in a fast
staggered sweep, the way a chart recorder draws. It happens once, it is under 600ms end to
end, and it is fully disabled under `prefers-reduced-motion`.

Everything else is state feedback at 120–180ms. No page-load choreography, no decorative
transitions.

## Browser surfaces

Themed from the palette, not left at browser defaults: text selection, caret, scrollbars,
focus rings. These are the cheapest evidence that a surface was built rather than
assembled.

## Rules this system will not break

- Unmeasured renders as `—` in `--unknown`. Never `0`, never `100%`, never a placeholder
  bar.
- No smooth interpolation between buckets.
- No colour on an inactive or non-semantic element.
- No card wrapping another card.
