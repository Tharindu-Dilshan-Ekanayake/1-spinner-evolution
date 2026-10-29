import { formatNumber } from '@shared'

import { sfx } from '../../audio/sfx'
import Icon from './Icon'
import StrokeText from './StrokeText'
import { GRADIENTS, u } from './style'

/** Red circular attention badge ("!" or a small count). */
export function AlertBadge({ size = 44, style, children = '!' }) {
  return (
    <span
      className="pointer-events-none absolute z-10 flex items-center justify-center rounded-full"
      style={{
        minWidth: u(size),
        height: u(size),
        padding: `0 ${u(size * 0.15)}`,
        background: 'radial-gradient(circle at 35% 30%, #ff7a7a, #ee1b2e 60%, #b80f1f)',
        border: `${u(3.5)} solid #fff`,
        boxShadow: `0 0 0 ${u(2.5)} #111`,
        fontSize: u(size * 0.62),
        ...style,
      }}
    >
      <StrokeText stroke={u(4)}>{children}</StrokeText>
    </span>
  )
}

/** A price: the currency icon and the amount, gold - or red while you can't afford it. */
export function Price({ amount, size = 34, afford = true, icon = 'trophy', className = '', style }) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: u(size * 0.12), fontSize: u(size), lineHeight: 1, ...style }}>
      <Icon name={icon} size={u(size * 1.1)} />
      <StrokeText stroke={u(size * 0.24)} gradient={afford ? GRADIENTS.gold : GRADIENTS.priceShort}>
        {formatNumber(amount)}
      </StrokeText>
    </span>
  )
}

/**
 * The game's standard chunky button: gradient face with a glossy top, black outline,
 * and a dark lip it presses down into (see .pp-chunky). Children are laid out centred.
 * Plays the click sound unless `quiet`.
 */
export function ChunkyButton({ onClick, gradient = GRADIENTS.goldButton, className = '', style, children, disabled, title, radius = 14, border = 4, quiet = false, ...rest }) {
  // `relative` unless the caller places it absolutely: with both classes on one element
  // `relative` wins, and the button lands in the wrong place.
  const position = /\babsolute\b/.test(className) ? '' : 'relative'
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={
        onClick
          ? (e) => {
              if (!quiet) sfx.click()
              onClick(e)
            }
          : undefined
      }
      className={`pp-btn pp-chunky pointer-events-auto ${position} flex items-center justify-center ${className}`}
      style={{
        background: gradient,
        borderRadius: u(radius),
        border: `${u(border)} solid #111`,
        ...style,
      }}
      {...rest}
    >
      <span className="pp-gloss" style={{ borderRadius: `${u(radius * 0.7)} ${u(radius * 0.7)} ${u(radius * 0.45)} ${u(radius * 0.45)}` }} />
      {children}
    </button>
  )
}

/** Round slate button for the top-right corner (sound, daily, settings). */
export function RoundButton({ icon, label, onClick, alert, iconSize = 38 }) {
  return (
    <ChunkyButton gradient={GRADIENTS.slate} onClick={onClick} title={label} radius={32} style={{ width: u(64), height: u(64) }}>
      <Icon name={icon} size={u(iconSize)} />
      {alert && <AlertBadge size={26} style={{ top: u(-8), right: u(-8) }} />}
    </ChunkyButton>
  )
}
