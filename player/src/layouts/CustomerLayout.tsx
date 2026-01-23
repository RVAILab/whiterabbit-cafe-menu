import { SecondaryScreenLayout } from '../components/SecondaryScreenLayout'
import { useScreenContext } from '../context/ScreenContext'
import { AnimatePresence, motion } from 'framer-motion'
import type { MenuBoard, MenuSection, MenuItem, MenuItemGroup, MenuSectionItem, SecondaryScreen } from '../types'

// Transition variants for customer view
const screenVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

const transition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 25,
}

interface CustomerLayoutProps {
  board: MenuBoard
  announcementBar?: string
  ignoreStockLevels?: boolean
}

/**
 * Customer layout - scrollable, touch-friendly, works on phones/laptops.
 * Used at / (root) route.
 */
export function CustomerLayout({
  board,
  announcementBar,
  ignoreStockLevels,
}: CustomerLayoutProps) {
  const { mode, activeScreen, showScreen, returnToPrimary, keyMap } = useScreenContext()

  // Get all secondary screens for reverse lookup
  const allScreens = Object.values(keyMap)

  // Find a secondary screen by direct reference (item.linkedSecondaryScreen -> screen)
  const findScreenByRef = (screenRef: { _id: string } | undefined): SecondaryScreen | null => {
    if (!screenRef) return null
    return allScreens.find((s) => s._id === screenRef._id) || null
  }

  // Find a secondary screen by reverse lookup (screen.linkedItem -> item)
  const findScreenForItemById = (itemId: string): SecondaryScreen | null => {
    return allScreens.find((s) => s.linkedItem?._id === itemId) || null
  }

  // Find a secondary screen by reverse lookup for section (screen.linkedSectionHeading -> heading)
  const findScreenForSectionByHeading = (heading: string): SecondaryScreen | null => {
    return allScreens.find((s) => s.linkedSectionHeading === heading) || null
  }

  // Combined lookup for items: try direct reference first, then reverse lookup
  const findScreenForMenuItem = (item: MenuSectionItem): SecondaryScreen | null => {
    // First try direct reference (menuItem/menuItemGroup -> secondaryScreen)
    const directRef = findScreenByRef(item.linkedSecondaryScreen)
    if (directRef) return directRef

    // Then try reverse lookup (secondaryScreen -> menuItem via linkedItem)
    // Only applies to menuItem type since groups don't have reverse lookup
    if (item._type === 'menuItem') {
      return findScreenForItemById(item._id)
    }
    return null
  }

  // Combined lookup for sections: try direct reference first, then reverse lookup by heading
  const findScreenForSection = (section: MenuSection): SecondaryScreen | null => {
    // First try direct reference (section -> secondaryScreen)
    const directRef = findScreenByRef(section.linkedSecondaryScreen)
    if (directRef) return directRef

    // Then try reverse lookup (secondaryScreen -> section via linkedSectionHeading)
    return findScreenForSectionByHeading(section.heading)
  }

  return (
    <div className="customer-layout">
      <AnimatePresence mode="wait">
        {mode === 'secondary' && activeScreen ? (
          <motion.div
            key="secondary"
            className="customer-secondary"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={screenVariants}
            transition={transition}
          >
            {/* Back button for customer view */}
            <button
              onClick={returnToPrimary}
              className="customer-back-button"
              style={{
                position: 'fixed',
                top: '1rem',
                left: '1rem',
                zIndex: 100,
                padding: '0.75rem 1.25rem',
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              ← Back to Menu
            </button>
            <SecondaryScreenLayout screen={activeScreen} />
          </motion.div>
        ) : (
          <motion.div
            key="primary"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={screenVariants}
            transition={transition}
          >
            {/* Header */}
            <header className="customer-header">
              <h1>{board.title || 'Menu'}</h1>
            </header>

            {/* Announcement Bar */}
            {announcementBar && (
              <div className="customer-announcement">
                {announcementBar}
              </div>
            )}

            {/* Menu Sections */}
            <main className="customer-menu">
              {board.sections?.map((section, index) => (
                <CustomerSection
                  key={index}
                  section={section}
                  ignoreStockLevels={ignoreStockLevels}
                  sectionScreen={findScreenForSection(section)}
                  findScreenForItem={findScreenForMenuItem}
                  showScreen={showScreen}
                />
              ))}
            </main>

            {/* Footer */}
            <footer className="customer-footer">
              <p>Tap items for more details</p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface CustomerSectionProps {
  section: MenuSection
  ignoreStockLevels?: boolean
  sectionScreen: SecondaryScreen | null
  findScreenForItem: (item: MenuSectionItem) => SecondaryScreen | null
  showScreen: (screen: SecondaryScreen) => void
}

function CustomerSection({
  section,
  ignoreStockLevels,
  sectionScreen,
  findScreenForItem,
  showScreen,
}: CustomerSectionProps) {
  const hasLinkedScreen = !!sectionScreen

  const handleSectionClick = () => {
    if (sectionScreen) showScreen(sectionScreen)
  }

  return (
    <section className="customer-section">
      {/* Section Header */}
      <h2
        className={`customer-section-header ${hasLinkedScreen ? 'tappable' : ''}`}
        onClick={hasLinkedScreen ? handleSectionClick : undefined}
        style={{ cursor: hasLinkedScreen ? 'pointer' : 'default' }}
      >
        {section.heading}
        {hasLinkedScreen && <span className="tap-indicator">›</span>}
      </h2>

      {/* Items */}
      <ul className="customer-items">
        {section.items?.map((item) => {
          if (item._type === 'menuItemGroup') {
            return (
              <CustomerItemGroup
                key={item._id}
                item={item}
                linkedScreen={findScreenForItem(item)}
                showScreen={showScreen}
              />
            )
          }
          return (
            <CustomerItem
              key={item._id}
              item={item}
              ignoreStockLevels={ignoreStockLevels}
              linkedScreen={findScreenForItem(item)}
              showScreen={showScreen}
            />
          )
        })}
      </ul>
    </section>
  )
}

interface CustomerItemProps {
  item: MenuItem
  ignoreStockLevels?: boolean
  linkedScreen: SecondaryScreen | null
  showScreen: (screen: SecondaryScreen) => void
}

function CustomerItem({ item, ignoreStockLevels, linkedScreen, showScreen }: CustomerItemProps): React.JSX.Element {
  const hasLinkedScreen = !!linkedScreen

  // Availability logic
  const isAvailable = (() => {
    if (item.availabilityOverride === 'always-available') return true
    if (item.availabilityOverride === 'force-unavailable') return false
    if (ignoreStockLevels) return true
    return item.isAvailable
  })()

  const handleClick = () => {
    if (linkedScreen) showScreen(linkedScreen)
  }

  return (
    <li
      className={`customer-item ${hasLinkedScreen ? 'tappable' : ''} ${!isAvailable ? 'unavailable' : ''}`}
      onClick={hasLinkedScreen ? handleClick : undefined}
      style={{ cursor: hasLinkedScreen ? 'pointer' : 'default' }}
    >
      <div className="customer-item-info">
        <span className="customer-item-name">
          {item.title}
          {item.dietaryTags?.includes('ALC') && ' 🌶️'}
        </span>
        {item.marketingDescription && (
          <span className="customer-item-desc">{item.marketingDescription}</span>
        )}
        {item.dietaryTags && item.dietaryTags.length > 0 && (
          <span className="customer-item-tags">
            {item.dietaryTags.filter(t => t !== 'ALC').join(' · ')}
          </span>
        )}
      </div>
      <div className="customer-item-right">
        <span className="customer-item-price">
          ${item.price?.toFixed(2)}
        </span>
        {hasLinkedScreen && <span className="tap-indicator">›</span>}
        {!isAvailable && <span className="sold-out-badge">SOLD OUT</span>}
      </div>
    </li>
  )
}

interface CustomerItemGroupProps {
  item: MenuItemGroup
  linkedScreen: SecondaryScreen | null
  showScreen: (screen: SecondaryScreen) => void
}

function CustomerItemGroup({ item, linkedScreen, showScreen }: CustomerItemGroupProps): React.JSX.Element {
  const hasLinkedScreen = !!linkedScreen

  const handleClick = () => {
    if (linkedScreen) showScreen(linkedScreen)
  }

  // Format price range - show single price if min === max
  const priceDisplay = item.priceRange.minPrice === item.priceRange.maxPrice
    ? `$${item.priceRange.minPrice.toFixed(2)}`
    : `$${item.priceRange.minPrice.toFixed(2)}-$${item.priceRange.maxPrice.toFixed(2)}`

  return (
    <li
      className={`customer-item ${hasLinkedScreen ? 'tappable' : ''}`}
      onClick={hasLinkedScreen ? handleClick : undefined}
      style={{ cursor: hasLinkedScreen ? 'pointer' : 'default' }}
    >
      <div className="customer-item-info">
        <span className="customer-item-name">
          {item.title}
          {item.dietaryTags?.includes('ALC') && ' 🌶️'}
        </span>
        <span className="customer-item-desc">{item.itemNames}</span>
        {item.dietaryTags && item.dietaryTags.length > 0 && (
          <span className="customer-item-tags">
            {item.dietaryTags.filter(t => t !== 'ALC').join(' · ')}
          </span>
        )}
      </div>
      <div className="customer-item-right">
        <span className="customer-item-price">
          {priceDisplay}
        </span>
        {hasLinkedScreen && <span className="tap-indicator">›</span>}
      </div>
    </li>
  )
}
