export type ProjectionLayout = 'standard' | 'rabbit-hole' | 'featured'

const isProjectionLayout = (value: unknown): value is ProjectionLayout =>
  value === 'standard' || value === 'rabbit-hole' || value === 'featured'

export interface EffectiveLayoutInputs {
  /** `location.search`; `?layout=` overrides everything. */
  search: string
  /** Display-control `desired.layout` (v2 only; v1 has none). */
  desiredLayout?: ProjectionLayout | null
}

/** The layout `/projection` renders: URL override, then display control, then standard (which renders as featured). */
export function resolveEffectiveLayout({ search, desiredLayout }: EffectiveLayoutInputs): ProjectionLayout {
  const override = new URLSearchParams(search).get('layout')
  if (isProjectionLayout(override)) return override
  if (isProjectionLayout(desiredLayout)) return desiredLayout
  return 'standard'
}
