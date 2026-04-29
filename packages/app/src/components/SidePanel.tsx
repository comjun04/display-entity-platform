import { type JSX, forwardRef } from 'react'

import { cn } from '@/lib/utils'

const SidePanel = forwardRef<HTMLDivElement, JSX.IntrinsicElements['div']>(
  ({ className, ...props }, ref) => {
    return (
      <div
        {...props}
        className={cn(
          'flex flex-col gap-1 rounded-lg bg-neutral-900 p-2 text-sm select-none',
          className,
        )}
        ref={ref}
      />
    )
  },
)
SidePanel.displayName = 'SidePanel'

const SidePanelTitle = forwardRef<HTMLDivElement, JSX.IntrinsicElements['div']>(
  ({ className, ...props }, ref) => {
    return <div {...props} className={cn('font-bold', className)} ref={ref} />
  },
)
SidePanelTitle.displayName = 'SidePanelTitle'

const SidePanelContent = forwardRef<
  HTMLDivElement,
  JSX.IntrinsicElements['div']
>(({ className, ...props }, ref) => {
  return (
    <div {...props} className={cn('overflow-y-auto', className)} ref={ref} />
  )
})
SidePanelContent.displayName = 'SidePanelContent'

export { SidePanel, SidePanelTitle, SidePanelContent }
