// schemas/menuBoard.ts
import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'menuBoard',
  title: 'Menu Board',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Board Name',
      type: 'string',
      description: 'e.g., "Daily Cafe Menu" or "Evening Bar"',
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'sections',
      title: 'Menu Sections',
      description: '⬍ Drag sections to reorder how they appear left-to-right on the display',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'section',
          title: 'Section',
          fields: [
            defineField({
              name: 'heading',
              title: 'Section Heading',
              type: 'string',
              description: 'e.g., "Espresso Drinks" or "Tap Beers"',
            }),
            defineField({
              name: 'metaCategory',
              title: 'Meta Category',
              type: 'string',
              description: 'Group this section under DRINK ME or EAT ME. Leave empty to hide from display.',
              options: {
                list: [
                  { title: 'Drink Me', value: 'drink-me' },
                  { title: 'Eat Me', value: 'eat-me' }
                ],
                layout: 'radio'
              },
              validation: (Rule) => Rule.optional()
            }),
            defineField({
              name: 'items',
              title: 'Items',
              type: 'array',
              of: [{ type: 'reference', to: { type: 'menuItem' } }],
              description: '⬍ Drag items to reorder top-to-bottom. Add items by clicking below.',
            }),
            defineField({
              name: 'modifiers',
              title: 'Modifiers',
              type: 'array',
              of: [{ type: 'reference', to: { type: 'menuModifier' } }],
              description: 'Optional modifiers displayed at the bottom of this section (e.g., "Alternative Milks")',
            }),
            defineField({
              name: 'linkedSecondaryScreen',
              title: 'Linked Secondary Screen',
              type: 'reference',
              to: [{ type: 'secondaryScreen' }],
              description: 'Optional: A secondary screen that provides detailed info about this section.',
            }),
          ],
          preview: {
            select: {
              title: 'heading',
              items: 'items',
              modifiers: 'modifiers',
            },
            prepare({ title, items, modifiers }) {
              const itemCount = items ? items.length : 0
              const modifierCount = modifiers ? modifiers.length : 0
              const subtitle = modifierCount > 0
                ? `${itemCount} items, ${modifierCount} modifiers`
                : `${itemCount} items`

              return {
                title: title || 'Untitled Section',
                subtitle: subtitle,
              }
            },
          },
        },
      ],
    }),
  ],
})