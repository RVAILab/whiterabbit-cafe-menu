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

console.log('Fetching data from Sanity...')
console.log('Project ID:', client.config().projectId)
console.log('Dataset:', client.config().dataset)
console.log('API Version:', client.config().apiVersion)
console.log('Perspective:', client.config().perspective)
console.log('CDN Disabled:', !client.config().useCdn)
console.log('\n' + '='.repeat(50) + '\n')

client.fetch(ACTIVE_BOARD_QUERY)
  .then(result => {
    console.log('✅ Query successful!')
    console.log('Result type:', typeof result)
    console.log('Result is array:', Array.isArray(result))
    console.log('Result length:', result?.length)
    console.log('\n' + '='.repeat(50) + '\n')
    console.log('Full result:')
    console.log(JSON.stringify(result, null, 2))

    if (result && result.length > 0) {
      const kioskSettings = result[0]
      console.log('\n' + '='.repeat(50) + '\n')
      console.log('Kiosk Settings Summary:')
      console.log('- Announcement Bar:', kioskSettings.announcementBar)
      console.log('- Ignore Stock Levels:', kioskSettings.ignoreStockLevels)
      console.log('- Active Board:', kioskSettings.activeBoard?.title)
      console.log('- Sections count:', kioskSettings.activeBoard?.sections?.length)

      if (kioskSettings.activeBoard?.sections) {
        console.log('\nSections:')
        kioskSettings.activeBoard.sections.forEach((section, idx) => {
          console.log(`  ${idx + 1}. ${section.heading} (${section.metaCategory})`)
          console.log(`     - Items: ${section.items?.length || 0}`)
          console.log(`     - Modifiers: ${section.modifiers?.length || 0}`)
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
