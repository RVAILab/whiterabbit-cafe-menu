// schemas/kioskSettings.ts
import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'kioskSettings',
  title: 'Kiosk Settings',
  type: 'document',
  fields: [
    defineField({
      name: 'activeBoard',
      title: 'Currently Active Menu',
      description: 'The menu selected here will be displayed on the projector instantly.',
      type: 'reference',
      to: [{ type: 'menuBoard' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'announcementBar',
      title: 'Announcement Banner',
      type: 'string',
      description: 'Optional scrolling text at the bottom (e.g., "Happy Hour starts at 5pm!")',
    }),
    defineField({
      name: 'ignoreStockLevels',
      title: 'Ignore Stock Levels',
      type: 'boolean',
      description:
        'When enabled, ALL items will show as available regardless of inventory status. Useful during setup or when inventory sync is being fixed.',
      initialValue: false,
    }),
  ],
  preview: {
    prepare() {
      return {
        title: 'Kiosk Global Settings',
      }
    },
  },
})