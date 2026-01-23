// schemas/ingredient.ts
import { defineField, defineType } from 'sanity'

export default defineType({
  name: 'ingredient',
  title: 'Ingredient',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Ingredient Name',
      type: 'string',
      description: 'The name of the ingredient (e.g., "Oat Milk", "Espresso")',
      validation: (Rule) => Rule.required().min(2).max(100),
    }),
    defineField({
      name: 'provider',
      title: 'Provider / Supplier',
      type: 'string',
      description: 'Where this ingredient comes from (e.g., "Local Farm", "Oatly")',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 2,
      description: 'Brief description of the ingredient',
      validation: (Rule) => Rule.max(300),
    }),
    defineField({
      name: 'benefit',
      title: 'Benefit / Feature',
      type: 'string',
      description: 'Key benefit or feature (e.g., "Rich in antioxidants", "Plant-based")',
      validation: (Rule) => Rule.max(100),
    }),
  ],
  preview: {
    select: {
      title: 'name',
      subtitle: 'provider',
    },
    prepare({ title, subtitle }) {
      return {
        title: title || 'Unnamed Ingredient',
        subtitle: subtitle || 'No provider specified',
      }
    },
  },
  orderings: [
    {
      title: 'Name A-Z',
      name: 'nameAsc',
      by: [{ field: 'name', direction: 'asc' }],
    },
  ],
})
