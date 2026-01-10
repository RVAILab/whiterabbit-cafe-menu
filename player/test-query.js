import { createClient } from '@sanity/client'

const client = createClient({
  projectId: '7h05nytv',
  dataset: 'production',
  apiVersion: '2023-05-03',
  token: 'sk72s5LMM6LyKHCeHarMU19riXpB6zWFlRB1eocTCIWkeMXUn1hLIjvcGF5UYPiQv8BgjVN5RbRxrB4FIXiJxHF9PcryAHJjRXQYLbjjMUAYn09SyhB7CECT8FfEVNr74GqWbYj5iJPYslGHyuIxa3CPuPSLk8TAE7JtR1oe2StTuWBFhHlC',
  useCdn: false,
  perspective: 'published',
})

const ACTIVE_BOARD_QUERY = `
  *[_type == "kioskSettings"] {
    announcementBar,
    ignoreStockLevels,
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
          linkedSecondaryScreen-> {
            _id,
            title,
            slug,
            triggerKey
          },
          image {
            asset-> {
              url
            }
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
    }
  }
`

const SECONDARY_SCREENS_QUERY = `
  *[_type == "secondaryScreen"] {
    _id,
    title,
    triggerKey
  }
`

console.log('Fetching data from Sanity...')
console.log('Project ID:', client.config().projectId)
console.log('Dataset:', client.config().dataset)
console.log('API Version:', client.config().apiVersion)
console.log('Perspective:', client.config().perspective)
console.log('CDN Disabled:', !client.config().useCdn)
console.log('\n' + '='.repeat(50) + '\n')

Promise.all([
  client.fetch(ACTIVE_BOARD_QUERY),
  client.fetch(SECONDARY_SCREENS_QUERY)
])
  .then(([settingsResult, screensResult]) => {
    console.log('✅ Query successful!')

    console.log('\n' + '='.repeat(50))
    console.log('SECONDARY SCREENS')
    console.log('='.repeat(50))
    console.log(`Found ${screensResult?.length || 0} secondary screens:`)
    screensResult?.forEach(screen => {
      console.log(`  - "${screen.title}" [key: ${screen.triggerKey}] (ID: ${screen._id})`)
    })

    console.log('\n' + '='.repeat(50))
    console.log('KIOSK SETTINGS')
    console.log('='.repeat(50))

    if (settingsResult && settingsResult.length > 0) {
      const kioskSettings = settingsResult[0]
      console.log('- Announcement Bar:', kioskSettings.announcementBar)
      console.log('- Ignore Stock Levels:', kioskSettings.ignoreStockLevels)
      console.log('- Active Board:', kioskSettings.activeBoard?.title)
      console.log('- Sections count:', kioskSettings.activeBoard?.sections?.length)

      if (kioskSettings.activeBoard?.sections) {
        console.log('\n' + '='.repeat(50))
        console.log('SECTIONS ANALYSIS')
        console.log('='.repeat(50))
        kioskSettings.activeBoard.sections.forEach((section, idx) => {
          console.log(`\n${idx + 1}. "${section.heading}"`)
          console.log(`   metaCategory: ${section.metaCategory || 'NOT SET ⚠️'}`)
          console.log(`   linkedSecondaryScreen: ${section.linkedSecondaryScreen ? `"${section.linkedSecondaryScreen.title}" [${section.linkedSecondaryScreen.triggerKey}]` : 'NOT SET'}`)
          console.log(`   Items: ${section.items?.length || 0}`)

          // Check items for linked screens
          section.items?.forEach(item => {
            if (item.linkedSecondaryScreen) {
              console.log(`     -> "${item.title}" links to "${item.linkedSecondaryScreen.title}" [${item.linkedSecondaryScreen.triggerKey}]`)
            }
          })
        })
      }
    } else {
      console.log('⚠️  No kiosk settings found!')
    }
  })
  .catch(err => {
    console.error('❌ Query failed:', err)
    console.error('Error type:', err.constructor.name)
    console.error('Error message:', err.message)
    if (err.details) {
      console.error('Error details:', JSON.stringify(err.details, null, 2))
    }
  })
