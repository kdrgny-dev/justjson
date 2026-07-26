import { cn } from '@/lib/utils'

export const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e'] as const

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}
