// TypeScript interfaces matching Sanity schemas

export type DietaryTag = 'VE' | 'V' | 'GF' | 'N' | 'ALC'

export type AvailabilityOverride = 'use-inventory' | 'always-available' | 'force-unavailable'

export type MetaCategory = 'drink-me' | 'eat-me'

export type DisplayStyle = 'inline' | 'list'

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
}

export interface MenuSection {
  heading: string
  metaCategory?: MetaCategory | null
  items?: MenuItem[] | null
  modifiers?: MenuModifier[] | null
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
}

// App State Interface
export interface MenuData {
  kioskSettings: KioskSettings | null
  isLoading: boolean
  error: string | null
}
