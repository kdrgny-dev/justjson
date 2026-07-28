import { SKELETON_KEYS, Skeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  CalendarDays,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  FileStack,
  History,
  LayoutGrid,
  Loader2,
  Newspaper,
  ShoppingBag,
  User,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TemplateMeta } from '../api'
import { t } from '../i18n'

const ICONS: Record<string, LucideIcon> = {
  blog: Newspaper,
  cv: User,
  portfolio: LayoutGrid,
  docs: BookOpen,
  changelog: History,
  recipe: ChefHat,
  event: CalendarDays,
  catalog: ShoppingBag,
}

const CARD = 'h-[168px] w-[264px] shrink-0 snap-start rounded-xl'
const FADE = 56
const MAX_CHIPS = 2

type Bleed = { left: number; right: number }

function reducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// Full-bleed is measured against the nearest scrolling ancestor rather than 100vw,
// so a classic (non-overlay) scrollbar cannot push the strip past the viewport.
function scrollAncestor(el: HTMLElement): HTMLElement {
  let node = el.parentElement
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
    node = node.parentElement
  }
  return document.documentElement
}

function useFullBleed() {
  const probeRef = useRef<HTMLDivElement>(null)
  const [bleed, setBleed] = useState<Bleed>({ left: 0, right: 0 })

  useLayoutEffect(() => {
    const probe = probeRef.current
    if (!probe) return
    const host = scrollAncestor(probe)
    const measure = () => {
      const own = probe.getBoundingClientRect()
      const rect = host.getBoundingClientRect()
      const hostLeft = rect.left + host.clientLeft
      setBleed({
        left: Math.max(0, Math.round(own.left - hostLeft)),
        right: Math.max(0, Math.round(hostLeft + host.clientWidth - own.right)),
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(probe)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  return { probeRef, bleed }
}

function TemplateCard({
  tpl,
  applying,
  onPick,
}: {
  tpl: TemplateMeta
  applying: string | null
  onPick: (id: string) => void
}) {
  const Icon = ICONS[tpl.id] ?? FileStack
  const active = applying === tpl.id
  const busy = applying !== null
  const chips = [
    ...tpl.collections.map((c) => ({ label: c.label, singleton: false })),
    ...tpl.singletons.map((s) => ({ label: s.label, singleton: true })),
  ]
  const shown = chips.slice(0, MAX_CHIPS)
  const rest = chips.length - shown.length

  return (
    <button
      type="button"
      data-carousel-card=""
      disabled={busy}
      aria-busy={active}
      onClick={() => onPick(tpl.id)}
      className={cn(
        CARD,
        'group relative flex flex-col overflow-hidden border border-border bg-card p-4 text-left',
        'shadow-sm outline-none transition-[box-shadow,transform,opacity,border-color] duration-200',
        'hover:border-primary/45 hover:shadow-md motion-safe:hover:-translate-y-0.5',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        busy && !active && 'opacity-40',
        busy && 'cursor-default',
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-primary/25">
          <Icon className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1 truncate font-heading text-sm font-bold tracking-tight text-foreground">
          {tpl.title}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
        {tpl.description}
      </p>

      <div className="mt-auto flex w-full flex-nowrap items-center gap-1 overflow-hidden pt-3">
        {shown.map((chip) => (
          <span
            key={chip.label}
            className={cn(
              'max-w-[45%] shrink-0 truncate rounded-md px-1.5 py-0.5 text-[11px] leading-5 text-muted-foreground',
              chip.singleton ? 'border border-border' : 'bg-muted',
            )}
          >
            {chip.label}
          </span>
        ))}
        {rest > 0 && (
          <span className="shrink-0 text-[11px] leading-5 text-muted-foreground/80">
            {t('+{n} more', { n: rest })}
          </span>
        )}
      </div>

      {active && (
        <span className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-card/85 text-sm font-medium text-primary backdrop-blur-[1px]">
          <Loader2 className="size-4 animate-spin" />
          {t('Applying…')}
        </span>
      )}
    </button>
  )
}

function SkeletonCard() {
  return (
    <div className={cn(CARD, 'flex flex-col border border-border bg-card p-4')}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 shrink-0 rounded-lg" />
        <Skeleton className="h-3.5 w-28" />
      </div>
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-3/5" />
      <div className="mt-auto flex gap-1.5 pt-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-14" />
      </div>
    </div>
  )
}

export function TemplateCarousel({
  templates,
  applying,
  onPick,
}: {
  templates: TemplateMeta[] | null
  applying: string | null
  onPick: (id: string) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const { probeRef, bleed } = useFullBleed()
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const sync = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setCanPrev(el.scrollLeft > 1)
    setCanNext(el.scrollLeft < max - 1)
  }, [])

  useEffect(() => {
    sync()
    const el = scrollerRef.current
    if (!el) return
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [sync])

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure once the strip is filled
  useEffect(sync, [templates, sync])

  const nudge = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-carousel-card]')
    const step = card ? card.offsetWidth + 16 : Math.round(el.clientWidth * 0.8)
    const max = el.scrollWidth - el.clientWidth
    const from = el.scrollLeft
    const target = Math.max(0, Math.min(from + dir * step, max))
    el.scrollTo({ left: target, behavior: reducedMotion() ? 'auto' : 'smooth' })
    // Bazı tarayıcılarda smooth kaydırma hiç uygulanmıyor (snap ile birlikte
    // sessizce düşüyor); hareket başlamadıysa doğrudan atlarız.
    window.setTimeout(() => {
      if (el.scrollLeft === from && from !== target) el.scrollLeft = target
    }, 80)
  }

  const left = canPrev ? FADE : 0
  const right = canNext ? FADE : 0
  const mask = `linear-gradient(to right, transparent 0, black ${left}px, black calc(100% - ${right}px), transparent 100%)`

  return (
    <section aria-labelledby="template-catalog-label">
      <div className="flex items-center justify-between gap-4">
        <h2
          id="template-catalog-label"
          className="font-heading text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
        >
          {t('Template catalog')}
        </h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('Previous templates')}
            disabled={!canPrev}
            onClick={() => nudge(-1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t('Next templates')}
            disabled={!canNext}
            onClick={() => nudge(1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div ref={probeRef} aria-hidden="true" className="h-0" />

      <div
        ref={scrollerRef}
        onScroll={sync}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pt-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          marginLeft: -bleed.left,
          marginRight: -bleed.right,
          paddingLeft: bleed.left,
          paddingRight: bleed.right,
          scrollPaddingLeft: bleed.left,
          scrollPaddingRight: bleed.right + FADE,
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      >
        {templates === null
          ? SKELETON_KEYS.slice(0, 4).map((key) => <SkeletonCard key={key} />)
          : templates.map((tpl) => (
              <TemplateCard key={tpl.id} tpl={tpl} applying={applying} onPick={onPick} />
            ))}
      </div>
    </section>
  )
}
