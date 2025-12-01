import type { MenuModifier } from '../types'

interface ModifierGroupProps {
  modifier: MenuModifier
}

export function ModifierGroup({ modifier }: ModifierGroupProps) {
  const { title, displayStyle, globalPrice, options } = modifier

  // Inline Display Mode: "Vanilla, Caramel, Hazelnut"
  if (displayStyle === 'inline') {
    return (
      <div
        style={{
          marginTop: '1.5rem',
        }}
      >
        {/* Modifier Title - Same style as section headers */}
        <h3
          style={{
            fontSize: '2vw',
            color: '#ff4d9f',
            fontWeight: '700',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
          }}
        >
          {title}
        </h3>

        {/* Inline Options and Price */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              fontSize: '1.3vw',
              color: '#a8ff70',
              fontWeight: '300',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {options.map((opt) => opt.name).join(', ')}
          </span>

          {/* Global Price Display */}
          {globalPrice !== undefined && (
            <span
              className="tabular-nums"
              style={{
                fontSize: '1.3vw',
                color: '#a8ff70',
                fontWeight: '300',
                letterSpacing: '0.05em',
              }}
            >
              +${globalPrice.toFixed(2)}
            </span>
          )}
        </div>
      </div>
    )
  }

  // List Display Mode: Vertical stack with individual prices
  return (
    <div
      style={{
        marginTop: '1.5rem',
      }}
    >
      {/* Modifier Title - Same style as section headers */}
      <h3
        style={{
          fontSize: '2vw',
          color: '#ff4d9f',
          fontWeight: '700',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '0.5rem',
        }}
      >
        {title}
        {globalPrice !== undefined && (
          <span
            className="tabular-nums"
            style={{
              marginLeft: '1rem',
              color: '#a8ff70',
              fontWeight: '300',
            }}
          >
            +${globalPrice.toFixed(2)}
          </span>
        )}
      </h3>

      {/* List Options */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem',
        }}
      >
        {options.map((option, index) => (
          <div
            key={`${option.name}-${index}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '1rem',
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontSize: '1.3vw',
                color: '#a8ff70',
                fontWeight: '300',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {option.name}
            </span>

            {/* Show individual prices when they exist */}
            {option.price !== undefined && (
              <span
                className="tabular-nums"
                style={{
                  fontSize: '1.3vw',
                  color: '#a8ff70',
                  fontWeight: '300',
                }}
              >
                +${option.price.toFixed(2)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
