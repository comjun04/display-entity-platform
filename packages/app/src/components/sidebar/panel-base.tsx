import {
  type JSX,
  createContext,
  forwardRef,
  useContext,
  useId,
  useState,
} from 'react'
import { LuChevronDown, LuChevronLeft } from 'react-icons/lu'

import { cn } from '@/lib/utils'

type SidePanelContextValue = {
  expanded: boolean
  setExpanded: (expanded: boolean) => void
  contentId: string
}

const SidePanelContext = createContext<SidePanelContextValue | null>(null)

const useSidePanel = () => {
  const context = useContext(SidePanelContext)
  if (!context) throw new Error('SidePanel components must be inside SidePanel')
  return context
}

const SidePanel = forwardRef<HTMLDivElement, JSX.IntrinsicElements['div']>(
  ({ className, ...props }, ref) => {
    const [expanded, setExpanded] = useState(true)
    const contentId = useId()

    return (
      <SidePanelContext.Provider value={{ expanded, setExpanded, contentId }}>
        <div
          {...props}
          className={cn(
            'flex flex-col gap-1 rounded-lg bg-neutral-900 p-2 text-sm select-none',
            className,
          )}
          ref={ref}
        />
      </SidePanelContext.Provider>
    )
  },
)
SidePanel.displayName = 'SidePanel'

const SidePanelTitle = forwardRef<HTMLDivElement, JSX.IntrinsicElements['div']>(
  ({ className, children, ...props }, ref) => {
    const { expanded, setExpanded } = useSidePanel()

    return (
      <div
        {...props}
        className={cn(
          'flex items-center justify-between gap-2 font-bold',
          className,
        )}
        ref={ref}
      >
        <span>{children}</span>
        <button
          type="button"
          className="rounded p-1 text-gray-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <LuChevronDown size={16} /> : <LuChevronLeft size={16} />}
        </button>
      </div>
    )
  },
)
SidePanelTitle.displayName = 'SidePanelTitle'

const SidePanelContent = forwardRef<
  HTMLDivElement,
  JSX.IntrinsicElements['div']
>(({ className, ...props }, ref) => {
  const { expanded, contentId } = useSidePanel()

  return (
    <div
      {...props}
      id={contentId}
      hidden={!expanded}
      className={cn('overflow-y-auto', className, !expanded && 'hidden')}
      ref={ref}
    />
  )
})
SidePanelContent.displayName = 'SidePanelContent'

export { SidePanel, SidePanelTitle, SidePanelContent }
