import type { MenuModifier } from '../types'

interface ModifierGroupProps {
  modifier: MenuModifier
}

export function ModifierGroup({ modifier }: ModifierGroupProps) {
  const { title, displayStyle, globalPrice, options } = modifier

  // Format price helper
  const fmtPrice = (p: number) => (p === 0 ? 'Gratis' : `+${p.toFixed(2)}`)

  // Build the options string with prices
  const optionParts = options.map((opt) => {
    if (displayStyle === 'list' && opt.price != null) {
      return `${opt.name} ${fmtPrice(opt.price)}`
    }
    return opt.name
  })

  // Global price suffix (for inline mode or list with global price)
  const priceSuffix =
    globalPrice != null && displayStyle === 'inline'
      ? ` · ${fmtPrice(globalPrice)}`
      : globalPrice != null && displayStyle === 'list'
        ? ` ${fmtPrice(globalPrice)}`
        : ''

  return (
    <div
      style={{
        marginTop: '0.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: '0.3rem',
      }}
    >
      <span
        style={{
          fontSize: '0.88vw',
          color: '#ff4d9f',
          fontWeight: '700',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {title}:
      </span>
      <span
        style={{
          fontSize: '0.88vw',
          color: '#a8ff70',
          fontWeight: '300',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {optionParts.join(' · ')}
        {priceSuffix}
      </span>
    </div>
  )
}
