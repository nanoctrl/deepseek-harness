// StateDot: session state indicator (figma nodes 14:3303/3305/3312, 122:9182).
// done/warning/error: 10x10 halo (same color, 10% opacity) around a 6x6 solid
// core. ongoing: a ring of 8 lights chasing clockwise around a soft glowing
// core. Colors resolve through --dsw-* tokens only.

import clsx from 'clsx'
import css from './StateDot.module.css'

/** Four-color state semantic (green done / amber user-attention / fuchsia running ring / red error). */
export type StateDotState = 'done' | 'warning' | 'ongoing' | 'error'

/** Number of lights in the ongoing orbit. */
const ORBIT_COUNT = 8

/** Orbit radius and per-light radius on the 10-unit viewBox grid. */
const ORBIT_RADIUS = 3.2
const LIGHT_RADIUS = 1.25

/** Clockwise orbit positions from the top (12 o'clock), rounded for clean attrs. */
const ORBIT_LIGHTS: readonly (readonly [number, number])[] = Array.from(
  { length: ORBIT_COUNT },
  (_, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / ORBIT_COUNT
    const cx = Number((5 + ORBIT_RADIUS * Math.cos(angle)).toFixed(2))
    const cy = Number((5 + ORBIT_RADIUS * Math.sin(angle)).toFixed(2))
    return [cx, cy] as const
  },
)

/**
 * Render a state dot.
 * @param props.state - which of the four states to show.
 * @param props.size - outer diameter in px (default 10, the figma size).
 * @param props.className - extra class for layout placement.
 * @returns the dot element (aria-hidden; pair with text for accessibility).
 */
export function StateDot({ state, size = 10, className }: {
  state: StateDotState
  size?: number | undefined
  className?: string | undefined
}) {
  if (state === 'ongoing') {
    return (
      <svg
        className={clsx(css.ring, className)}
        data-state="ongoing"
        width={size}
        height={size}
        viewBox="0 0 10 10"
        aria-hidden="true"
      >
        <circle className={css.core} cx="5" cy="5" r="4" />
        {ORBIT_LIGHTS.map(([cx, cy], index) => (
          <circle
            key={`${cx}-${cy}`}
            className={css.light}
            cx={cx}
            cy={cy}
            r={LIGHT_RADIUS}
            /* Negative delay phases the chase so every light animates from mount. */
            style={{ animationDelay: `${(index - ORBIT_COUNT) * 125}ms` }}
          />
        ))}
      </svg>
    )
  }
  return (
    <span
      className={clsx(css.dot, className)}
      data-state={state}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}
