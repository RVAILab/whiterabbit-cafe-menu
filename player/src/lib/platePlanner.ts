import {
  PROJECTED_MENU_SECTIONS,
  type ProjectedMenuDocument,
  type ProjectedMenuSectionV2,
} from './projectedMenu'

export type PlateSection = ProjectedMenuSectionV2
/**
 * Plates 1 and 2 hold drink-me, plate 3 holds eat-me, and plate 4 holds the
 * bar. Plate 4 has no column of its own: it stacks under plate 3.
 */
export type Plates = [PlateSection[], PlateSection[], PlateSection[], PlateSection[]]

/**
 * Estimated rendered lines for a section: the reference player's heuristic.
 * Only the relative sizes matter; it chooses a split, it doesn't fit type.
 */
export function estimateLines(section: PlateSection): number {
  return 1.4 + section.items.reduce((lines, item) => {
    const variants = item.variants.length
    if (variants > 3) return lines + 1 + Math.ceil(variants / 2) * 0.75
    if (variants > 1) return lines + 1.6
    return lines + (item.name.length > 22 ? 1.8 : 1)
  }, 0)
}

const sumLines = (sections: PlateSection[]) =>
  sections.reduce((lines, section) => lines + estimateLines(section), 0)

// Keep order; pick the split point that minimizes the taller column.
function splitTwo(sections: PlateSection[]): [PlateSection[], PlateSection[]] {
  let best: [PlateSection[], PlateSection[]] = [sections, []]
  let bestHeight = Infinity
  for (let k = 0; k <= sections.length; k++) {
    const left = sections.slice(0, k)
    const right = sections.slice(k)
    const height = Math.max(sumLines(left), sumLines(right))
    if (height < bestHeight) {
      bestHeight = height
      best = [left, right]
    }
  }
  return best
}

function toV2Sections(document: ProjectedMenuDocument): PlateSection[] {
  if (document.schemaVersion === 2) return document.sections

  // v1 carries no side or position; the static metadata order supplies both,
  // and items get the same alphabetical order as the standard layout.
  return document.sections.flatMap((section) => {
    const position = PROJECTED_MENU_SECTIONS.findIndex(({ id }) => id === section.id)
    if (position < 0) return []
    return [{
      id: section.id,
      name: section.name,
      side: PROJECTED_MENU_SECTIONS[position].metaCategory,
      position,
      items: [...section.items].sort((left, right) => left.name.localeCompare(right.name)),
    }]
  })
}

export function planPlates(document: ProjectedMenuDocument): Plates {
  const sections = toV2Sections(document)
    .filter((section) => section.items.length > 0)
    .sort((left, right) => left.position - right.position)
  const side = (name: PlateSection['side']) => sections.filter((section) => section.side === name)
  const [plate1, plate2] = splitTwo(side('drink-me'))
  return [plate1, plate2, side('eat-me'), side('bar')]
}
