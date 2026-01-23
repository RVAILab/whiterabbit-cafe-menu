// schemas/menuItemGroup.ts
import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'menuItemGroup',
  title: 'Menu Item Group',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Group Title',
      type: 'string',
      description: 'Display name for the group (e.g., "Teas", "Herbal Infusions")',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'itemNames',
      title: 'Item Names',
      type: 'text',
      rows: 2,
      description: 'Comma-separated list of items in this group (e.g., "Earl Grey, English Breakfast, Chamomile, Green Tea")',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'priceRange',
      title: 'Price Range',
      type: 'object',
      description: 'Displayed as "$3.75-$5.50" on the menu',
      fields: [
        defineField({
          name: 'minPrice',
          title: 'Minimum Price',
          type: 'number',
          validation: (Rule) => Rule.required().min(0).precision(2),
        }),
        defineField({
          name: 'maxPrice',
          title: 'Maximum Price',
          type: 'number',
          validation: (Rule) => Rule.required().min(0).precision(2),
        }),
      ],
      validation: (Rule) =>
        Rule.custom((priceRange) => {
          if (!priceRange) return 'Price range is required'
          const { minPrice, maxPrice } = priceRange as { minPrice?: number; maxPrice?: number }
          if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
            return 'Minimum price cannot be greater than maximum price'
          }
          return true
        }),
    }),
    defineField({
      name: 'dietaryTags',
      title: 'Dietary Tags',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Tags that apply to items in this group',
      options: {
        list: [
          { title: 'Vegan', value: 'VE' },
          { title: 'Vegetarian', value: 'V' },
          { title: 'Gluten Free', value: 'GF' },
          { title: 'Contains Nuts', value: 'N' },
          { title: 'Alcoholic', value: 'ALC' },
        ],
      },
    }),
    defineField({
      name: 'linkedSecondaryScreen',
      title: 'Linked Secondary Screen',
      type: 'reference',
      to: [{ type: 'secondaryScreen' }],
      description: 'Optional: A secondary screen with more details about this group',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      itemNames: 'itemNames',
      minPrice: 'priceRange.minPrice',
      maxPrice: 'priceRange.maxPrice',
    },
    prepare({ title, itemNames, minPrice, maxPrice }) {
      const itemCount = itemNames ? itemNames.split(',').length : 0
      let priceDisplay = ''
      if (minPrice !== undefined && maxPrice !== undefined) {
        priceDisplay = minPrice === maxPrice
          ? `$${minPrice.toFixed(2)}`
          : `$${minPrice.toFixed(2)}-$${maxPrice.toFixed(2)}`
      }
      return {
        title: title || 'Untitled Group',
        subtitle: `${itemCount} items | ${priceDisplay}`,
      }
    },
  },
})
