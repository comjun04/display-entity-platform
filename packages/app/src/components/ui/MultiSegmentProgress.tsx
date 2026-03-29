import { Progress as ProgressPrimitive } from '@base-ui/react/progress'
import * as React from 'react'

import { cn } from '@/lib/utils'

const REMAINING_AREA_NAME = '__remaining_area__'

type MultiSegmentProgressProps = Omit<
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
  'value'
> & {
  segments: {
    id: string
    value: number
    className?: string
  }[]
  normalize?: boolean // if values should be normalized (e.g. values 1 1 2 -> fill 25% 25% 50% of progressbar)
}

const MultiSegmentProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  MultiSegmentProgressProps
>(({ className, segments, normalize = false, ...props }, ref) => {
  const sum = segments.reduce((acc, cur) => (acc += cur.value), 0)

  const segmentsCopy = segments.slice()
  if (!normalize && sum < 100) {
    segments.push({
      id: REMAINING_AREA_NAME,
      value: 100 - sum,
      className: 'bg-gray-700',
    })
  }

  let i = 0
  const segmentsWithRelativeValue = segmentsCopy.toReversed().map((segment) => {
    const ret = {
      ...segment,
      value: i,
    }
    i += segment.value
    return ret
  })

  return (
    <ProgressPrimitive.Root
      value={null}
      ref={ref}
      className={cn(
        'bg-primary/20 relative h-2 w-full overflow-hidden rounded-full',
        className,
      )}
      {...props}
    >
      {segmentsWithRelativeValue.map((segment) => {
        const value = normalize ? (segment.value / sum) * 100 : segment.value
        return (
          <ProgressPrimitive.Indicator
            key={segment.id}
            className={cn(
              'absolute h-full w-full flex-1 transition-all',
              segment.className,
            )}
            style={{ transform: `translateX(-${value}%)` }}
          />
        )
      })}
    </ProgressPrimitive.Root>
  )
})
MultiSegmentProgress.displayName = ProgressPrimitive.Root.displayName

export { MultiSegmentProgress }
