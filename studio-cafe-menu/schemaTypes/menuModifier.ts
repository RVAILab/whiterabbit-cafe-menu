// schemas/menuModifier.ts
import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'menuModifier',
  title: 'Menu Modifier',
  type: 'document',
  description: 'Global modifiers like "Alternative Milks" or "Extra Toppings" that can be added to menu sections',
  fields: [
    defineField({
      name: 'title',
      title: 'Modifier Title',
      type: 'string',
      description: 'e.g., "Alternative Milks", "Extra Toppings", "Add-Ons"',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'displayStyle',
      title: 'Display Style',
      type: 'string',
      description: 'How to display the modifier options on screen',
      options: {
        list: [
          { title: 'Inline (comma-separated)', value: 'inline' },
          { title: 'List (vertical stack)', value: 'list' }
        ],
        layout: 'radio'
      },
      initialValue: 'inline',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'globalPrice',
      title: 'Global Price (Optional)',
      type: 'number',
      description: 'If set, this flat rate applies to all options. Leave empty to price each option individually.',
      validation: (Rule) => Rule.min(0).precision(2),
    }),
    defineField({
      name: 'options',
      title: 'Modifier Options',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'modifierOption',
          title: 'Option',
          fields: [
            defineField({
              name: 'name',
              title: 'Option Name',
              type: 'string',
              description: 'e.g., "Oat Milk", "Almond Milk", "Extra Shot"',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'price',
              title: 'Price',
              type: 'number',
              description: 'Individual price for this option (ignored if Global Price is set)',
              initialValue: 0,
              validation: (Rule) => Rule.min(0).precision(2).required(),
            }),
          ],
          preview: {
            select: {
              name: 'name',
              price: 'price',
            },
            prepare({ name, price }) {
              return {
                title: name,
                subtitle: `$${price.toFixed(2)}`,
              }
            },
          },
        }
      ],
      validation: (Rule) => Rule.required().min(1),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      displayStyle: 'displayStyle',
      options: 'options',
      globalPrice: 'globalPrice',
    },
    prepare({ title, displayStyle, options, globalPrice }) {
      const optionCount = options ? options.length : 0
      const priceInfo = globalPrice
        ? `Global: $${globalPrice.toFixed(2)}`
        : 'Individual pricing'

      return {
        title: title,
        subtitle: `${displayStyle} | ${optionCount} options | ${priceInfo}`,
      }
    },
  },
})
