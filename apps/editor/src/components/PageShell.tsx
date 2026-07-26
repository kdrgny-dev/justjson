import { cn } from '@/lib/utils'
import { FileJson2 } from 'lucide-react'
import type { ReactNode } from 'react'

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col">{children}</div>
}

export function PageHeader({
  title,
  badge,
  subtitle,
  actions,
  toolbar,
}: {
  title: string
  badge?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  toolbar?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-20 shrink-0 border-b bg-card px-8 pt-4 pb-3.5">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-lg font-semibold leading-tight tracking-tight text-foreground">
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <div className="mt-1.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {toolbar && <div className="mt-3.5">{toolbar}</div>}
    </header>
  )
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
}

export function PagePane({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-hidden px-8 py-6">{children}</div>
}

export function Surface({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow-sm', className)}>
      {children}
    </div>
  )
}

export function PathChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
      <FileJson2 className="h-3 w-3 shrink-0 text-muted-foreground/70" />
      <span className="truncate">{children}</span>
    </span>
  )
}

export function SurfaceEmpty({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
