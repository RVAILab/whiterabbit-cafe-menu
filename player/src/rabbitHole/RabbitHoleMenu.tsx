import { useRef } from 'react'
import type { Plates } from '../lib/platePlanner'
import { RabbitHoleItem } from './RabbitHoleItem'
import { useAutoFit } from './useAutoFit'

/**
 * Titles and the three plates. Titles and plates carry `rh-gulp-target` and
 * `data-gulp-order` (titles 0, plates by index) for the gulp to animate.
 * Auto-fits `--fs` to the plates; `onDoesNotFit` fires when even 26px overflows.
 */
export function RabbitHoleMenu({ plates, onDoesNotFit }: { plates: Plates; onDoesNotFit?: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null)
  useAutoFit(menuRef, plates, onDoesNotFit)

  return (
    <div ref={menuRef} className="rh-menu" data-testid="rabbit-hole-menu">
      <div className="rh-titles">
        <h2 className="rh-title rh-title-drink rh-gulp-target" data-gulp-order={0}>
          Drink <i>✦</i> Me
        </h2>
        <h2 className="rh-title rh-title-eat rh-gulp-target" data-gulp-order={0}>
          Eat <i>✦</i> Me
        </h2>
      </div>
      <div className="rh-plates">
        {plates.map((sections, index) => (
          <div
            key={index}
            className="rh-plate rh-gulp-target"
            data-gulp-order={index}
            data-testid={`rabbit-hole-plate-${index + 1}`}
          >
            {sections.map((section) => (
              <section key={section.id}>
                <h3 className="rh-section-heading">{section.name}</h3>
                {section.items.map((item) => <RabbitHoleItem key={item.id} item={item} />)}
              </section>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
