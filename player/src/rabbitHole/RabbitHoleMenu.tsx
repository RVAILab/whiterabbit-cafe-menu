import { useRef } from 'react'
import type { PlateSection, Plates } from '../lib/platePlanner'
import { RabbitHoleItem } from './RabbitHoleItem'
import { useAutoFit } from './useAutoFit'

function Plate({ sections, order, testId }: { sections: PlateSection[]; order: number; testId: string }) {
  return (
    <div className="rh-plate rh-gulp-target" data-gulp-order={order} data-testid={testId}>
      {sections.map((section) => (
        <section key={section.id}>
          <h3 className="rh-section-heading">{section.name}</h3>
          {section.items.map((item) => <RabbitHoleItem key={item.id} item={item} />)}
        </section>
      ))}
    </div>
  )
}

const barTitle = (order: number) => (
  <h2 className="rh-title rh-title-bar rh-gulp-target" data-gulp-order={order}>
    Bar
  </h2>
)

/**
 * Titles and the plates: drink-me on columns 1–2, eat-me in column 3. With
 * bar sections, column 3 stacks the eat-me plate, the Bar title and the bar
 * plate; with no eat-me sections, the bar takes column 3 on its own. Titles
 * and plates carry `rh-gulp-target` and `data-gulp-order` (titles 0, plates by
 * index, the stacked Bar title and plate 3) for the gulp to animate.
 * Auto-fits `--fs` to the plates; `onDoesNotFit` fires when even 26px overflows.
 */
export function RabbitHoleMenu({ plates, onDoesNotFit }: { plates: Plates; onDoesNotFit?: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null)
  useAutoFit(menuRef, plates, onDoesNotFit)
  const [drink1, drink2, eat, bar] = plates
  const barOnly = bar.length > 0 && eat.length === 0
  const stacked = bar.length > 0 && eat.length > 0

  return (
    <div ref={menuRef} className="rh-menu" data-testid="rabbit-hole-menu">
      <div className="rh-titles">
        <h2 className="rh-title rh-title-drink rh-gulp-target" data-gulp-order={0}>
          Drink <i>✦</i> Me
        </h2>
        {barOnly ? barTitle(0) : (
          <h2 className="rh-title rh-title-eat rh-gulp-target" data-gulp-order={0}>
            Eat <i>✦</i> Me
          </h2>
        )}
      </div>
      <div className="rh-plates">
        <Plate sections={drink1} order={0} testId="rabbit-hole-plate-1" />
        <Plate sections={drink2} order={1} testId="rabbit-hole-plate-2" />
        {stacked ? (
          <div className="rh-stack" data-testid="rabbit-hole-stack">
            <Plate sections={eat} order={2} testId="rabbit-hole-plate-3" />
            {barTitle(3)}
            <Plate sections={bar} order={3} testId="rabbit-hole-plate-bar" />
          </div>
        ) : barOnly ? (
          <Plate sections={bar} order={2} testId="rabbit-hole-plate-bar" />
        ) : (
          <Plate sections={eat} order={2} testId="rabbit-hole-plate-3" />
        )}
      </div>
    </div>
  )
}
