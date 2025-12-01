// Test script to verify Sanity connection and data
import { createClient } from '@sanity/client'

const client = createClient({
  projectId: '7h05nytv',
  dataset: 'production',
  apiVersion: '2023-05-03',
  token: 'sk72s5LMM6LyKHCeHarMU19riXpB6zWFlRB1eocTCIWkeMXUn1hLIjvcGF5UYPiQv8BgjVN5RbRxrB4FIXiJxHF9PcryAHJjRXQYLbjjMUAYn09SyhB7CECT8FfEVNr74GqWbYj5iJPYslGHyuIxa3CPuPSLk8TAE7JtR1oe2StTuWBFhHlC',
  useCdn: false,
  perspective: 'published',
})

async function testConnection() {
  console.log('🔍 Testing Sanity connection...\n')

  try {
    // Test 1: Check for kioskSettings documents
    console.log('1️⃣ Checking for kioskSettings documents...')
    const kioskSettings = await client.fetch('*[_type == "kioskSettings"]')
    console.log(`   Found ${kioskSettings.length} kioskSettings document(s)`)
    if (kioskSettings.length > 0) {
      console.log('   Data:', JSON.stringify(kioskSettings, null, 2))
    }

    // Test 2: Check for menuBoard documents
    console.log('\n2️⃣ Checking for menuBoard documents...')
    const menuBoards = await client.fetch('*[_type == "menuBoard"]')
    console.log(`   Found ${menuBoards.length} menuBoard document(s)`)
    if (menuBoards.length > 0) {
      console.log('   Boards:', menuBoards.map(b => b.title || b._id))
    }

    // Test 3: Check for menuItem documents
    console.log('\n3️⃣ Checking for menuItem documents...')
    const menuItems = await client.fetch('*[_type == "menuItem"]')
    console.log(`   Found ${menuItems.length} menuItem document(s)`)

    // Test 4: Try the full query
    console.log('\n4️⃣ Testing full ACTIVE_BOARD_QUERY...')
    const fullQuery = `
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
    const result = await client.fetch(fullQuery)
    console.log('   Query result:', JSON.stringify(result, null, 2))

    if (result.length === 0 || !result[0]?.activeBoard) {
      console.log('\n❌ PROBLEM FOUND:')
      if (result.length === 0) {
        console.log('   No kioskSettings document exists.')
        console.log('   👉 You need to create a kioskSettings document in Sanity Studio')
      } else if (!result[0].activeBoard) {
        console.log('   kioskSettings exists but has no activeBoard reference.')
        console.log('   👉 You need to set an active menu board in the kioskSettings document')
      }
    } else {
      console.log('\n✅ SUCCESS: Query returned valid data!')
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message)
    console.error('Full error:', error)
  }
}

testConnection()
