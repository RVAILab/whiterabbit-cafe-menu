import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CalibrationApi } from '../context/calibrationContext'
import { DEFAULT_PROJECTED_MENU_URL } from '../hooks/useProjectedMenu'
import { useUpcomingEvent } from '../hooks/useUpcomingEvent'
import { fitBaseSize } from '../lib/autoFit'
import { formatRelativeEventTime } from '../lib/eventTime'
import type { ProjectedMenuDocumentV2, ProjectedMenuItemV2 } from '../lib/projectedMenu'
import { CalibrationGrid, CalibrationHandles } from '../rabbitHole/Calibration'
import { PinnedSurface } from '../rabbitHole/PinnedSurface'
import { useEventTitleFit } from '../rabbitHole/useEventTitleFit'
import { Stage, StageLayer } from '../rabbitHole/Stage'
import { itemPrice, planFeatured, type FeaturedBlock } from './planFeatured'
import '../rabbitHole/rabbitHole.css'
import './featured.css'

/** Liquid colour of the drawn cup, by drink block index (lead, then the grid). */
const CUP_COLORS = ['#c49a6c', '#5e4a86', '#c8873a', '#b97a3f', '#3f6fa0']

function imageSrc(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null
  try {
    return new URL(imageUrl, DEFAULT_PROJECTED_MENU_URL).href
  } catch {
    return null
  }
}

const SPIN_SECONDS = 90

/** The 240px picture: the item's photo, else (or if it fails to load) a drawn top-down cup, or a plate for food. */
function Picture({ item, color, plate = false }: { item: ProjectedMenuItemV2; color?: string; plate?: boolean }) {
  const src = imageSrc(item.imageUrl)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  if (src && src !== failedSrc) {
    return <img
        className="ft-pic ft-spin"
        src={src}
        alt={item.name}
        // Each photo starts at its own angle so the cups don't turn in lockstep.
        style={{ animationDelay: `-${((item.templateId * 0.618) % 1) * SPIN_SECONDS}s` }}
        onError={() => setFailedSrc(src)}
      />
  }
  return (
    <svg className="ft-pic" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="49" fill={plate ? '#efeadf' : '#e4ddcd'} />
      <circle cx="50" cy="50" r="40" fill="#f7f4ed" stroke="#cfc6b2" strokeWidth="1" />
      {plate ? (
        <g transform="rotate(-20 50 50)">
          <rect x="22" y="30" width="30" height="40" rx="12" fill="#d9b77a" />
          <rect x="50" y="34" width="30" height="40" rx="12" fill="#d9b77a" />
          <ellipse cx="50" cy="51" rx="5" ry="15" fill="#f1e7d2" />
        </g>
      ) : (
        <>
          <circle cx="50" cy="50" r="34" fill={color} />
          <g className="ft-swirl">
            <path
              d="M50 50 m0 -2 a2 2 0 1 1 -2 2 a5 5 0 1 1 5 5 a9 9 0 1 1 -9 -9 a14 14 0 1 1 14 14 a19 19 0 1 1 -19 -19 a24 24 0 1 1 24 24"
              fill="none"
              stroke="#f3e6cf"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </g>
        </>
      )}
    </svg>
  )
}

const Line = ({ item }: { item: ProjectedMenuItemV2 }) => (
  <div className="ft-li"><span className="ft-nm">{item.name}</span><span className="ft-pr">{itemPrice(item)}</span></div>
)

const Hero = ({ item }: { item: ProjectedMenuItemV2 }) => (
  <div className="ft-hero"><span className="ft-nm">{item.name}</span><span className="ft-pr">{itemPrice(item)}</span></div>
)

function LeadBlock({ block }: { block: FeaturedBlock }) {
  return (
    <section className="ft-lead ft-dim" aria-label={block.label} data-ft-box>
      <div className="ft-lead-head">
        {block.featured && <Picture key={block.featured.id} item={block.featured} color={CUP_COLORS[0]} />}
        <div className="ft-lead-title">
          <div className="ft-lbl">{block.label}</div>
          {block.featured && <Hero item={block.featured} />}
        </div>
      </div>
      {block.items.length > 0 && (
        <div className="ft-lead-list">{block.items.map((item) => <Line key={item.id} item={item} />)}</div>
      )}
    </section>
  )
}

function GridBlock({ block, color }: { block: FeaturedBlock; color: string }) {
  return (
    <section className="ft-block ft-dim" aria-label={block.label}>
      <div className="ft-lbl">{block.label}</div>
      {block.featured && <Picture key={block.featured.id} item={block.featured} color={color} />}
      {block.featured && <Hero item={block.featured} />}
      {block.items.map((item) => <Line key={item.id} item={item} />)}
    </section>
  )
}

function FoodCapsule({ blocks }: { blocks: FeaturedBlock[] }) {
  return (
    <section className="ft-food" aria-label="Food" data-ft-box>
      {blocks.map((block) => (
        <div key={block.id} className="ft-food-section ft-dim">
          {block.featured && <Picture key={block.featured.id} item={block.featured} plate />}
          <div className="ft-lbl">{block.label}</div>
          {block.featured && <Hero item={block.featured} />}
          {block.items.map((item) => <Line key={item.id} item={item} />)}
        </div>
      ))}
    </section>
  )
}

/** "What's next": the real next event from Rova; a quiet house line when there is none, nothing while loading. */
// The card's title room: kept above the cup handle; shrinks until every word fits its width.
const NEXT_TITLE_SIZES = [32, 30, 28, 26, 24, 22, 20, 18] as const
const NEXT_TITLE_MAX_HEIGHT = 104

function WhatsNext() {
  const { upcomingEvent, isLoading } = useUpcomingEvent({
    enabled: true,
    pollInterval: parseInt(import.meta.env.VITE_ROVA_POLL_INTERVAL || '60000', 10),
  })
  const titleRef = useRef<HTMLDivElement>(null)
  const title = isLoading ? null : upcomingEvent ? upcomingEvent.title : "We're all mad here"
  useEventTitleFit(titleRef, title, NEXT_TITLE_SIZES, NEXT_TITLE_MAX_HEIGHT)
  if (isLoading) return null
  return (
    <section className="ft-next" aria-label="What's next" data-testid="ft-next">
      <div className="ft-lbl ft-next-lbl">{upcomingEvent ? "What's next" : 'White Rabbit'}</div>
      <div ref={titleRef} className="ft-next-title">{title}</div>
      {upcomingEvent && <div className="ft-next-time">{formatRelativeEventTime(upcomingEvent.startsAt)}</div>}
    </section>
  )
}

/**
 * Report overflow: after each layout (and once web fonts load), any block box
 * whose content overflows it means the menu does not fit this wall.
 */
/** Text scales auto-fit tries, largest first; 0.82 keeps list text at the rabbit hole's ~23px floor. */
const FIT_SCALES = [1, 0.94, 0.88, 0.82] as const

function useOverflowCheck(content: unknown, onDoesNotFit?: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const onDoesNotFitRef = useRef(onDoesNotFit)
  useLayoutEffect(() => {
    onDoesNotFitRef.current = onDoesNotFit
  })
  useLayoutEffect(() => {
    let disposed = false
    const check = () => {
      const menu = ref.current
      if (disposed || !menu) return
      const boxes = [...menu.querySelectorAll<HTMLElement>('[data-ft-box]')]
      // Shrink the text (never the pictures) step by step, as the rabbit hole does, before giving up.
      const result = fitBaseSize((scale) => {
        menu.style.setProperty('--ft-s', String(scale))
        return boxes.map(({ scrollHeight, clientHeight }) => ({ scrollHeight, clientHeight }))
      }, FIT_SCALES)
      menu.style.setProperty('--ft-s', String(result.fs))
      if (result.fits) return
      const over = boxes.filter((box) => box.scrollHeight > box.clientHeight + 1)
      const names = over.map((box) => `${box.getAttribute('aria-label')} (${box.scrollHeight}/${box.clientHeight}px)`)
      console.warn(`Menu does not fit the featured layout (${names.join(', ')}); falling back to the standard layout.`)
      onDoesNotFitRef.current?.()
    }
    check()
    globalThis.document?.fonts?.ready.then(check, () => {})
    return () => {
      disposed = true
    }
  }, [content])
  return ref
}

export interface FeaturedLayoutProps {
  document: ProjectedMenuDocumentV2
  calibration?: Pick<CalibrationApi, 'corners' | 'isCalibrating' | 'selectedCorner' | 'selectCorner' | 'setCorner'>
  /** Under the lead block, which gives up the height (the clubhouse notice). */
  footer?: ReactNode
  /** Viewport-space overlays (sleep / closed / massage), as in the rabbit hole. */
  overlays?: ReactNode
  /** Stage state classes, e.g. `clubhouse` (dims the menu). */
  stageClassName?: string
  /** Called when a block's content overflows its box. */
  onDoesNotFit?: () => void
}

/**
 * The featured wall: a 1920×1080 stage on the pinned surface. Tunnel rings
 * behind the drinks, "What's next" tilted top-left, the first drink section
 * as the lead block, the next four in a 2×2 grid, food in a capsule on the right.
 */
export function FeaturedLayout({ document, calibration, footer, overlays, stageClassName, onDoesNotFit }: FeaturedLayoutProps) {
  const plan = useMemo(() => planFeatured(document), [document])
  const hasFooter = Boolean(footer)
  const fitContent = useMemo(() => ({ plan, hasFooter }), [plan, hasFooter])
  const menuRef = useOverflowCheck(fitContent, onDoesNotFit)
  const [lead, ...grid] = plan.drinks

  return (
    <PinnedSurface
      corners={calibration?.corners}
      overlays={overlays}
      viewport={calibration?.isCalibrating && calibration.corners && (
        <CalibrationHandles
          corners={calibration.corners}
          selectedCorner={calibration.selectedCorner}
          onSelect={calibration.selectCorner}
          onMove={calibration.setCorner}
        />
      )}
    >
      <Stage className={['ft-stage', stageClassName].filter(Boolean).join(' ')}>
        <StageLayer layer="background">
          <div className="ft-tunnel" aria-hidden="true">
            {[0, -2.2, -4.4, -6.6, -8.8, -11].map((delay) => (
              <div key={delay} className="ft-ring" style={{ animationDelay: `${delay}s` }} />
            ))}
          </div>
        </StageLayer>
        <StageLayer layer="hole-event"><WhatsNext /></StageLayer>
        <StageLayer layer="menu">
          <div ref={menuRef} className="ft-menu" data-testid="featured-menu">
            <div className="ft-left">
              {lead && <LeadBlock block={lead} />}
              {footer}
            </div>
            {/* Two columns stacked by content height, so a long section borrows room from a short one under it. */}
            <div className="ft-grid">
              {[0, 1].map((col) => (
                <div key={col} className="ft-grid-col" aria-label={`Drinks column ${col + 1}`} data-ft-box>
                  {grid.map((block, i) => i % 2 === col && (
                    <GridBlock key={block.id} block={block} color={CUP_COLORS[i + 1]} />
                  ))}
                </div>
              ))}
            </div>
            {plan.food.length > 0 && <FoodCapsule blocks={plan.food} />}
          </div>
        </StageLayer>
        <StageLayer layer="calibration-grid">{calibration?.isCalibrating && <CalibrationGrid />}</StageLayer>
      </Stage>
    </PinnedSurface>
  )
}
