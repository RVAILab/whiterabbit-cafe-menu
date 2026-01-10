import { createClient } from '@sanity/client'

// Sanity client configuration
export const client = createClient({
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID || '7h05nytv',
  dataset: import.meta.env.VITE_SANITY_DATASET || 'production',
  apiVersion: import.meta.env.VITE_SANITY_API_VERSION || '2023-05-03',
  token: import.meta.env.VITE_SANITY_TOKEN, // Read token for fetching data
  useCdn: false, // Use false for real-time updates, true for better caching
  perspective: 'published', // Only fetch published documents
})

// GROQ Query to fetch the active menu board with all sections and items
// NOTE: No [0] slice operator - must return array for listener to work correctly
export const ACTIVE_BOARD_QUERY = `
  *[_type == "kioskSettings"] {
    announcementBar,
    ignoreStockLevels,
    defaultTimeoutSeconds,
    activeBoard-> {
      title,
      slug,
      sections[] {
        heading,
        metaCategory,
        linkedSecondaryScreen-> {
          _id,
          title,
          slug,
          triggerKey
        },
        items[]-> {
          _id,
          title,
          price,
          isAvailable,
          availabilityOverride,
          marketingDescription,
          dietaryTags,
          image {
            asset-> {
              url
            }
          },
          linkedSecondaryScreen-> {
            _id,
            title,
            slug,
            triggerKey
          }
        },
        modifiers[]-> {
          _id,
          title,
          displayStyle,
          globalPrice,
          options[] {
            name,
            price
          }
        }
      }
    },
    activeSecondaryScreen-> {
      _id,
      title,
      slug,
      triggerKey,
      screenType,
      layout,
      timeoutSeconds,
      heroImage {
        asset-> {
          url
        }
      },
      backgroundColor,
      heading,
      subheading,
      content,
      bulletPoints,
      linkedItem-> {
        _id,
        title,
        price,
        marketingDescription,
        dietaryTags,
        image {
          asset-> {
            url
          }
        }
      }
    }
  }
`

// GROQ Query to fetch all secondary screens for building the key map
export const SECONDARY_SCREENS_QUERY = `
  *[_type == "secondaryScreen"] {
    _id,
    title,
    slug,
    triggerKey,
    screenType,
    layout,
    timeoutSeconds,
    heroImage {
      asset-> {
        url
      }
    },
    backgroundColor,
    heading,
    subheading,
    content,
    bulletPoints,
    linkedItem-> {
      _id,
      title,
      price,
      marketingDescription,
      dietaryTags,
      image {
        asset-> {
          url
        }
      }
    },
    linkedSectionHeading
  }
`
