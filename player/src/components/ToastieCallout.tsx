import type { MenuItem as MenuItemType, MenuModifier } from '../types'

interface ToastieCalloutProps {
  item: MenuItemType
  modifier: MenuModifier
}

export function ToastieCallout({ item, modifier }: ToastieCalloutProps) {
  return (
    <div
      style={{
        marginTop: '1rem',
        border: '1px solid rgba(255, 77, 159, 0.4)',
        borderRadius: '0.5rem',
        padding: '0.8rem 1rem',
        background: 'rgba(255, 77, 159, 0.06)',
      }}
    >
      {/* Header: item name + price */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '0.4rem',
        }}
      >
        <span
          style={{
            fontSize: '1.04vw',
            fontWeight: '700',
            color: '#ff4d9f',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {item.title}
          <span
            style={{
              fontSize: '0.72vw',
              color: '#a8ff70',
              fontWeight: '700',
              marginLeft: '0.15rem',
            }}
          >
            V
          </span>
        </span>
        <span
          className="tabular-nums"
          style={{
            fontSize: '1.2vw',
            color: '#7ed957',
            fontWeight: '400',
          }}
        >
          {item.price.toFixed(2)}
        </span>
      </div>

      {/* Description */}
      {item.marketingDescription && (
        <div
          style={{
            fontSize: '0.88vw',
            color: '#a8ff70',
            fontWeight: '300',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
          }}
        >
          {item.marketingDescription}
        </div>
      )}

      {/* Modifier title */}
      <div
        style={{
          fontSize: '0.88vw',
          color: '#ff4d9f',
          fontWeight: '700',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '0.3rem',
        }}
      >
        {modifier.title}
      </div>

      {/* Options as a compact list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.15rem',
        }}
      >
        {modifier.options.map((opt, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontSize: '0.88vw',
                color: '#a8ff70',
                fontWeight: '300',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {opt.name}
            </span>
            {opt.price != null && opt.price > 0 && (
              <span
                className="tabular-nums"
                style={{
                  fontSize: '0.88vw',
                  color: '#a8ff70',
                  fontWeight: '300',
                }}
              >
                +{opt.price.toFixed(2)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
