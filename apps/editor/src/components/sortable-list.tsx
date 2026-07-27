import { Button } from '@/components/ui/button'
import { t } from '@/i18n'
import { cn } from '@/lib/utils'
import type { Announcements } from '@dnd-kit/core'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'
import { forwardRef, useState } from 'react'

export const DragHandle = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & { label: string }
>(({ label, className, ...props }, ref) => (
  <Button
    ref={ref}
    type="button"
    variant="ghost"
    size="icon-xs"
    aria-label={label}
    title={label}
    className={cn(
      'cursor-grab touch-none text-muted-foreground/50 hover:bg-transparent hover:text-foreground active:cursor-grabbing',
      className,
    )}
    {...props}
  >
    <GripVertical />
  </Button>
))
DragHandle.displayName = 'DragHandle'

/** Dikey eksende, kendi listesi içinde sıralanabilen bir grup. */
export function SortableList({
  ids,
  onReorder,
  renderOverlay,
  children,
}: {
  ids: string[]
  onReorder: (from: number, to: number) => void
  renderOverlay: (id: string) => React.ReactNode
  children: React.ReactNode
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const position = (id: string | number) => ids.indexOf(String(id)) + 1
  const announcements: Announcements = {
    onDragStart: () => t('Item picked up. Use the arrow keys to move it, space to drop it.'),
    onDragOver: ({ over }) =>
      over
        ? t('Moving to position {n}.', { n: position(over.id) })
        : t('The item is outside the list.'),
    onDragEnd: ({ over }) =>
      over
        ? t('Dropped at position {n}.', { n: position(over.id) })
        : t('The item returned to its original place.'),
    onDragCancel: () => t('Move cancelled.'),
  }

  return (
    <DndContext
      accessibility={{ announcements }}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={({ active, over }) => {
        setActiveId(null)
        if (!over || active.id === over.id) return
        const from = ids.indexOf(String(active.id))
        const to = ids.indexOf(String(over.id))
        if (from < 0 || to < 0) return
        onReorder(from, to)
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay>{activeId ? renderOverlay(activeId) : null}</DragOverlay>
    </DndContext>
  )
}
