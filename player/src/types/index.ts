// TypeScript interfaces matching Sanity schemas

export type DietaryTag = 'VE' | 'V' | 'GF' | 'N' | 'ALC'

export type AvailabilityOverride = 'use-inventory' | 'always-available' | 'force-unavailable'

export type MetaCategory = 'drink-me' | 'eat-me'

export type DisplayStyle = 'inline' | 'list'

// Secondary Screen Types
export type ScreenType = 'section-linked' | 'item-linked' | 'independent'
export type ScreenLayout = 'fullscreen' | 'overlay' | 'split'

// Portable Text block (simplified)
export interface ContentBlock {
  _type: 'block' | 'image'
  _key: string
  children?: Array<{
    _type: string
    _key: string
    text?: string
    marks?: string[]
  }>
  style?: string
  markDefs?: Array<{ _type: string; _key: string }>
  asset?: {
    _ref: string
    url?: string
  }
}

// Secondary Screen Reference (lightweight, for linking)
export interface SecondaryScreenRef {
  _id: string
  title: string
  slug: { current: string }
  triggerKey: string
}

// Full Secondary Screen
export interface SecondaryScreen {
  _id: string
  title: string
  slug: { current: string }
  triggerKey: string
  screenType: ScreenType
  layout: ScreenLayout
  timeoutSeconds?: number
  heroImage?: {
    asset: {
      url: string
    }
  }
  backgroundColor?: string
  heading?: string
  subheading?: string
  content?: ContentBlock[]
  bulletPoints?: string[]
  linkedItem?: MenuItem
}

export interface ModifierOption {
  name: string
  price: number
}

export interface MenuModifier {
  _id: string
  title: string
  displayStyle: DisplayStyle
  globalPrice?: number
  options: ModifierOption[]
}

export interface MenuItem {
  _id: string
  title: string
  price: number
  isAvailable: boolean
  availabilityOverride?: AvailabilityOverride
  marketingDescription?: string
  dietaryTags?: DietaryTag[]
  image?: {
    asset: {
      url: string
    }
  }
  linkedSecondaryScreen?: SecondaryScreenRef
}

export interface MenuSection {
  heading: string
  metaCategory?: MetaCategory | null
  items?: MenuItem[] | null
  modifiers?: MenuModifier[] | null
  linkedSecondaryScreen?: SecondaryScreenRef
}

export interface MenuBoard {
  title: string
  slug: {
    current: string
  }
  sections?: MenuSection[] | null
}

export interface KioskSettings {
  announcementBar?: string
  ignoreStockLevels?: boolean
  activeBoard: MenuBoard
  activeSecondaryScreen?: SecondaryScreen | null
  defaultTimeoutSeconds?: number
}

// App State Interface
export interface MenuData {
  kioskSettings: KioskSettings | null
  secondaryScreens: SecondaryScreen[]
  isLoading: boolean
  error: string | null
}

// Key map for keyboard-triggered screens
export type SecondaryScreenKeyMap = Record<string, SecondaryScreen>
