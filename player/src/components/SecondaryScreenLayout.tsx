import type { SecondaryScreen, ContentBlock } from '../types'
import { useTimeout } from '../hooks/useTimeout'

interface SecondaryScreenLayoutProps {
  screen: SecondaryScreen
}

/**
 * Layout component for displaying a secondary screen.
 * Handles fullscreen, overlay, and split layouts with timeout indicator.
 */
export function SecondaryScreenLayout({ screen }: SecondaryScreenLayoutProps) {
  const { timeoutRemaining } = useTimeout()

  const backgroundColor = screen.backgroundColor || '#0a0a0a'
  const heroImageUrl = screen.heroImage?.asset?.url

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{
        backgroundColor,
        color: '#ffffff',
        fontFamily: "'PP Pangram Sans Rounded', system-ui, sans-serif",
      }}
    >
      {/* Hero Image (if present) */}
      {heroImageUrl && screen.layout === 'fullscreen' && (
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url(${heroImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: 0,
          }}
        />
      )}

      {/* Main Content */}
      <div
        className="flex-1 flex flex-col items-center justify-center relative"
        style={{
          zIndex: 1,
          padding: '4vw',
        }}
      >
        {/* Heading */}
        {screen.heading && (
          <h1
            style={{
              fontSize: '6vw',
              fontWeight: 700,
              color: '#ff4d9f',
              marginBottom: '1vw',
              textAlign: 'center',
            }}
          >
            {screen.heading}
          </h1>
        )}

        {/* Subheading */}
        {screen.subheading && (
          <h2
            style={{
              fontSize: '2.5vw',
              fontWeight: 500,
              color: '#fbbf24',
              marginBottom: '2vw',
              textAlign: 'center',
            }}
          >
            {screen.subheading}
          </h2>
        )}

        {/* Bullet Points */}
        {screen.bulletPoints && screen.bulletPoints.length > 0 && (
          <ul
            style={{
              fontSize: '2vw',
              lineHeight: 1.8,
              marginBottom: '2vw',
              listStyle: 'none',
              padding: 0,
            }}
          >
            {screen.bulletPoints.map((point, index) => (
              <li
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1vw',
                  marginBottom: '0.5vw',
                }}
              >
                <span style={{ color: '#7ed957' }}>●</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Rich Text Content */}
        {screen.content && screen.content.length > 0 && (
          <div
            style={{
              fontSize: '1.8vw',
              lineHeight: 1.6,
              maxWidth: '80%',
              textAlign: 'center',
            }}
          >
            {screen.content.map((block) => renderContentBlock(block))}
          </div>
        )}

        {/* Linked Item Detail (for item-linked screens) */}
        {screen.screenType === 'item-linked' && screen.linkedItem && (
          <div
            className="flex items-center gap-8"
            style={{
              marginTop: '3vw',
            }}
          >
            {screen.linkedItem.image?.asset?.url && (
              <img
                src={screen.linkedItem.image.asset.url}
                alt={screen.linkedItem.title}
                style={{
                  width: '20vw',
                  height: '20vw',
                  objectFit: 'cover',
                  borderRadius: '1vw',
                }}
              />
            )}
            <div>
              <h3
                style={{
                  fontSize: '3vw',
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: '0.5vw',
                }}
              >
                {screen.linkedItem.title}
              </h3>
              <p
                style={{
                  fontSize: '2.5vw',
                  fontWeight: 700,
                  color: '#7ed957',
                  marginBottom: '1vw',
                }}
              >
                ${screen.linkedItem.price?.toFixed(2)}
              </p>
              {screen.linkedItem.marketingDescription && (
                <p
                  style={{
                    fontSize: '1.5vw',
                    color: '#cccccc',
                    maxWidth: '40vw',
                  }}
                >
                  {screen.linkedItem.marketingDescription}
                </p>
              )}
              {screen.linkedItem.dietaryTags && screen.linkedItem.dietaryTags.length > 0 && (
                <div
                  className="flex gap-2"
                  style={{ marginTop: '1vw' }}
                >
                  {screen.linkedItem.dietaryTags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '1.2vw',
                        padding: '0.3vw 0.6vw',
                        backgroundColor: '#333333',
                        borderRadius: '0.3vw',
                        color: '#fbbf24',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {/* Ingredients */}
              {screen.linkedItem.ingredients && screen.linkedItem.ingredients.length > 0 && (
                <div style={{ marginTop: '1.5vw' }}>
                  <h4
                    style={{
                      fontSize: '1.3vw',
                      fontWeight: 600,
                      color: '#ff4d9f',
                      marginBottom: '0.5vw',
                    }}
                  >
                    Ingredients
                  </h4>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                    }}
                  >
                    {screen.linkedItem.ingredients.map((ingredient) => (
                      <li
                        key={ingredient._id}
                        style={{
                          fontSize: '1.2vw',
                          marginBottom: '0.3vw',
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '0.5vw',
                        }}
                      >
                        <span style={{ color: '#ffffff' }}>{ingredient.name}</span>
                        {ingredient.benefit && (
                          <span style={{ color: '#7ed957', fontSize: '1vw' }}>
                            — {ingredient.benefit}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Timeout Indicator */}
      <TimeoutIndicator secondsRemaining={timeoutRemaining} />

      {/* Keyboard Hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '2vw',
          left: '2vw',
          fontSize: '1.2vw',
          color: '#666666',
        }}
      >
        Press ESC to return to menu
      </div>
    </div>
  )
}

/**
 * Visual indicator showing remaining time before auto-return
 */
function TimeoutIndicator({ secondsRemaining }: { secondsRemaining: number | null }) {
  if (secondsRemaining === null) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: '2vw',
        right: '2vw',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5vw',
        fontSize: '1.5vw',
        color: '#666666',
      }}
    >
      <span>Auto-return in</span>
      <span
        style={{
          fontWeight: 700,
          color: secondsRemaining <= 5 ? '#ef4444' : '#fbbf24',
          minWidth: '2vw',
          textAlign: 'right',
        }}
      >
        {secondsRemaining}s
      </span>
    </div>
  )
}

/**
 * Render a single content block (simplified portable text rendering)
 */
function renderContentBlock(block: ContentBlock): React.ReactNode {
  if (block._type === 'block' && block.children) {
    const text = block.children
      .filter((child) => child._type === 'span')
      .map((child) => child.text || '')
      .join('')

    const style: React.CSSProperties = {}

    switch (block.style) {
      case 'h2':
        style.fontSize = '2.5vw'
        style.fontWeight = 600
        style.marginBottom = '1vw'
        style.color = '#ff4d9f'
        break
      case 'h3':
        style.fontSize = '2vw'
        style.fontWeight = 500
        style.marginBottom = '0.8vw'
        style.color = '#fbbf24'
        break
      case 'blockquote':
        style.fontStyle = 'italic'
        style.borderLeft = '4px solid #7ed957'
        style.paddingLeft = '1vw'
        style.marginBottom = '1vw'
        break
      default:
        style.marginBottom = '0.8vw'
    }

    return (
      <p key={block._key} style={style}>
        {text}
      </p>
    )
  }

  if (block._type === 'image' && block.asset?.url) {
    return (
      <img
        key={block._key}
        src={block.asset.url}
        alt=""
        style={{
          maxWidth: '60vw',
          maxHeight: '40vh',
          objectFit: 'contain',
          borderRadius: '1vw',
          marginBottom: '1vw',
        }}
      />
    )
  }

  return null
}
