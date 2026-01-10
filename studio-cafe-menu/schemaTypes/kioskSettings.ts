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
    defineField({
      name: 'activeSecondaryScreen',
      title: 'Active Secondary Screen',
      type: 'reference',
      to: [{ type: 'secondaryScreen' }],
      description:
        'Optional: Set a secondary screen to display instead of the menu board. Usually controlled via keyboard on player device.',
    }),
    defineField({
      name: 'defaultTimeoutSeconds',
      title: 'Default Secondary Screen Timeout',
      type: 'number',
      description: 'Default seconds before secondary screens auto-return to the menu (default: 30)',
      initialValue: 30,
      validation: (Rule) => Rule.min(5).max(300),
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