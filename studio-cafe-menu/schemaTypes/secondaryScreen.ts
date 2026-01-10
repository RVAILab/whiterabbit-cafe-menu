// schemas/secondaryScreen.ts
import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'secondaryScreen',
  title: 'Secondary Screen',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Screen Title',
      type: 'string',
      description: 'Internal name for this screen (e.g., "Coffee Deep Dive", "Nutritional Info")',
      validation: (Rule) => Rule.required(),
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
      name: 'triggerKey',
      title: 'Trigger Key',
      type: 'string',
      description: 'Keyboard key to trigger this screen (e.g., "C" for coffee, "1" for screen 1). Case-insensitive.',
      validation: (Rule) => Rule.required().max(1).uppercase(),
    }),
    defineField({
      name: 'screenType',
      title: 'Screen Type',
      type: 'string',
      description: 'What kind of content does this screen show?',
      options: {
        list: [
          { title: 'Section Detail', value: 'section-linked' },
          { title: 'Item Detail', value: 'item-linked' },
          { title: 'Independent Content', value: 'independent' },
        ],
        layout: 'radio',
      },
      initialValue: 'independent',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'linkedItem',
      title: 'Linked Item',
      type: 'reference',
      to: [{ type: 'menuItem' }],
      description: 'For item-linked screens: the item to display in detail. Also makes this item tappable in customer view.',
      hidden: ({ parent }) => parent?.screenType !== 'item-linked',
    }),
    defineField({
      name: 'linkedSectionHeading',
      title: 'Linked Section Heading',
      type: 'string',
      description: 'For section-linked screens: the exact section heading to link (e.g., "Coffee Drinks"). Makes that section tappable in customer view.',
      hidden: ({ parent }) => parent?.screenType !== 'section-linked',
    }),
    defineField({
      name: 'layout',
      title: 'Layout Style',
      type: 'string',
      options: {
        list: [
          { title: 'Fullscreen', value: 'fullscreen' },
          { title: 'Overlay', value: 'overlay' },
          { title: 'Split View', value: 'split' },
        ],
        layout: 'radio',
      },
      initialValue: 'fullscreen',
    }),
    defineField({
      name: 'timeoutSeconds',
      title: 'Auto-Return Timeout (seconds)',
      type: 'number',
      description: 'Seconds before automatically returning to primary menu. Leave empty to use global default (30s).',
      validation: (Rule) => Rule.min(5).max(300),
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero Image',
      type: 'image',
      description: 'Large background or featured image for this screen',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'backgroundColor',
      title: 'Background Color',
      type: 'string',
      description: 'Hex color for background (e.g., "#0a0a0a"). Defaults to dark theme.',
    }),
    defineField({
      name: 'heading',
      title: 'Screen Heading',
      type: 'string',
      description: 'Large heading displayed on the screen',
    }),
    defineField({
      name: 'subheading',
      title: 'Subheading',
      type: 'string',
      description: 'Optional subheading below the main heading',
    }),
    defineField({
      name: 'content',
      title: 'Content',
      type: 'array',
      of: [
        {
          type: 'block',
          styles: [
            { title: 'Normal', value: 'normal' },
            { title: 'Heading 2', value: 'h2' },
            { title: 'Heading 3', value: 'h3' },
            { title: 'Quote', value: 'blockquote' },
          ],
          marks: {
            decorators: [
              { title: 'Strong', value: 'strong' },
              { title: 'Emphasis', value: 'em' },
              { title: 'Highlight', value: 'highlight' },
            ],
          },
        },
        {
          type: 'image',
          options: { hotspot: true },
        },
      ],
      description: 'Rich text content with images for this screen',
    }),
    defineField({
      name: 'bulletPoints',
      title: 'Feature Points',
      type: 'array',
      of: [{ type: 'string' }],
      description: 'Optional bullet points displayed prominently (e.g., key features, benefits)',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      triggerKey: 'triggerKey',
      screenType: 'screenType',
      media: 'heroImage',
    },
    prepare({ title, triggerKey, screenType, media }) {
      const typeLabels: Record<string, string> = {
        'section-linked': 'Section',
        'item-linked': 'Item',
        'independent': 'Content',
      }
      return {
        title: `[${triggerKey || '?'}] ${title || 'Untitled'}`,
        subtitle: typeLabels[screenType] || screenType,
        media,
      }
    },
  },
  orderings: [
    {
      title: 'Trigger Key',
      name: 'triggerKeyAsc',
      by: [{ field: 'triggerKey', direction: 'asc' }],
    },
  ],
})
