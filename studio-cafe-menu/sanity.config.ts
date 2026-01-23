import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemaTypes'

const singletonActions = new Set(['publish', 'discardChanges', 'restore'])
const singletonTypes = new Set(['kioskSettings'])

export default defineConfig({
  name: 'default',
  title: 'Cafe Menu',

  projectId: '7h05nytv',
  dataset: 'production',

  plugins: [structureTool({
    structure: (S) =>
      S.list()
        .title('Cafe Content')
        .items([
          // Singleton: Kiosk Settings
          S.listItem()
            .title('Kiosk Settings')
            .id('kioskSettings')
            .child(
              S.document()
                .schemaType('kioskSettings')
                .documentId('kioskSettings')
            ),

          S.divider(),

          // Regular Documents
          S.documentTypeListItem('menuBoard').title('Menu Boards'),
          S.documentTypeListItem('menuItem').title('Menu Items'),
          S.documentTypeListItem('menuModifier').title('Modifiers'),
          S.documentTypeListItem('ingredient').title('Ingredients'),

          S.divider(),

          // Secondary Screens
          S.documentTypeListItem('secondaryScreen').title('Secondary Screens'),
        ]),
  }),
  visionTool()],

  schema: {
    types: schemaTypes,
    // Filter out singleton types from the "create new" button
    templates: (templates) =>
      templates.filter(({ schemaType }) => !singletonTypes.has(schemaType)),
  },

  document: {
    // Disable "delete" and "duplicate" for singletons
    actions: (input, context) =>
      singletonTypes.has(context.schemaType)
        ? input.filter(({ action }) => action && singletonActions.has(action))
        : input,
  },
})
