// schemas/menuItem.ts
import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'menuItem',
  title: 'Menu Item',
  type: 'document',
  fields: [
    // --- ODOO SYNCED FIELDS (LOCKED) ---
    defineField({
      name: 'title',
      title: 'Item Name',
      type: 'string',
      description: 'Synced from Odoo. Do not edit here.',
      readOnly: true,
    }),
    defineField({
      name: 'price',
      title: 'Price',
      type: 'number',
      description: 'Synced from Odoo.',
      readOnly: true,
    }),
    defineField({
      name: 'isAvailable',
      title: 'In Stock',
      type: 'boolean',
      description: 'Synced from Odoo inventory status.',
      readOnly: true,
      initialValue: true,
    }),
    defineField({
      name: 'odooId',
      title: 'Odoo ID',
      type: 'number',
      description: 'The internal ID from Odoo used for matching.',
      readOnly: true,
      hidden: false, // Visible for debugging, but uneditable
    }),

    // --- SANITY PRESENTATION FIELDS (EDITABLE) ---
    defineField({
      name: 'availabilityOverride',
      title: 'Availability Override',
      type: 'string',
      description:
        'Override the inventory stock status. "Use Inventory" follows Odoo. "Always Available" forces item to show. "Force Unavailable" hides item.',
      options: {
        list: [
          { title: 'Use Inventory (Default)', value: 'use-inventory' },
          { title: 'Always Available', value: 'always-available' },
          { title: 'Force Unavailable', value: 'force-unavailable' },
        ],
        layout: 'radio',
      },
      initialValue: 'use-inventory',
    }),
    defineField({
      name: 'image',
      title: 'Display Image',
      type: 'image',
      options: {
        hotspot: true, // Allows you to crop the image center for different aspect ratios
      },
    }),
    defineField({
      name: 'marketingDescription',
      title: 'Marketing Description',
      type: 'text',
      rows: 3,
      description: 'A more attractive description than the technical one in Odoo.',
    }),
    defineField({
      name: 'dietaryTags',
      title: 'Dietary Tags',
      type: 'array',
      of: [{ type: 'string' }],
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
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'price',
      media: 'image',
      available: 'isAvailable'
    },
    prepare(selection) {
      const { title, subtitle, media, available } = selection
      return {
        title: title,
        subtitle: `$${subtitle} ${available ? '' : '(SOLD OUT)'}`,
        media: media,
      }
    },
  },
})