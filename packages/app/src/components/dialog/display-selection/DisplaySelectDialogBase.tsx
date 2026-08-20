import { Tooltip as BaseUITooltip } from '@base-ui/react'
import { useResizeObserver } from '@react-hookz/web'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type FC, memo, useMemo, useRef, useState } from 'react'

import { CDNBaseUrl } from '@/constants'
import { type ItemAtlasMetadataCalculated } from '@/hooks/useIconAtlas'

import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'

const ITEM_SIZE = 64
const ITEM_GAP = 4

interface VirtualListRowProps {
  height: number
  positionOffsetY: number

  items: string[]

  iconAtlasMetadata: ItemAtlasMetadataCalculated
  gameVersion: string

  onItemClick?: (key: string) => void
  tooltipHandle: BaseUITooltip.Handle<string>
}
const VirtualListRow: FC<VirtualListRowProps> = ({
  height,
  positionOffsetY,
  items,
  iconAtlasMetadata,
  gameVersion,
  onItemClick,
  tooltipHandle,
}) => {
  return (
    <div
      className="absolute top-0 left-0 mx-auto flex flex-row"
      style={{
        height,
        transform: `translateY(${positionOffsetY}px)`,

        gap: ITEM_GAP,
      }}
    >
      {items.map((key) => {
        const metadata = iconAtlasMetadata[key]
        const xOffset = metadata?.xOffset ?? 0
        const yOffset = metadata?.yOffset ?? 0

        return (
          <TooltipTrigger
            key={key}
            handle={tooltipHandle}
            delay={0}
            render={
              <button
                className="relative rounded border-2 border-transparent bg-neutral-800 transition duration-100 hover:border-yellow-400"
                style={{
                  width: ITEM_SIZE,
                  height: ITEM_SIZE,
                }}
                onClick={() => onItemClick?.(key)}
              >
                <div
                  className="absolute top-1/2 left-1/2 flex h-16 w-16 -translate-1/2 scale-90 items-center justify-center"
                  style={{
                    backgroundImage: `url(${CDNBaseUrl}/${gameVersion}/assets/minecraft/icon-atlas.png)`,
                    backgroundPositionX: -xOffset,
                    backgroundPositionY: -yOffset,
                  }}
                />
              </button>
            }
            payload={key}
          />
        )
      })}
    </div>
  )
}
const MemoizedVirtualListRow = memo(VirtualListRow, (prevProps, nextProps) => {
  for (const key of Object.keys(nextProps) as (keyof typeof nextProps)[]) {
    // check shallow equal for elements in `items` array
    // instead of just checking equality of instances
    // this enables to slice the original array but same elements with order
    // to be considered as equal
    if (key === 'items') {
      if (prevProps.items.length !== nextProps.items.length) return false

      const shallowEqual = nextProps.items.every(
        (v, i) => v === prevProps.items[i],
      )
      if (!shallowEqual) return false

      continue
    }

    // everything else just use Object.is()
    const prevVal = prevProps[key]
    const nextVal = nextProps[key]
    if (!Object.is(prevVal, nextVal)) return false
  }

  return true
})

interface VirtualListProps {
  items: string[]
  iconAtlasMetadata: ItemAtlasMetadataCalculated
  isLoading: boolean
  gameVersion: string
  onItemClick?: (key: string) => void
  tooltipHandle: BaseUITooltip.Handle<string>
}
const VirtualList: FC<VirtualListProps> = ({
  items,
  iconAtlasMetadata,
  isLoading,
  gameVersion,
  onItemClick,
  tooltipHandle,
}) => {
  const parentRef = useRef<HTMLDivElement>(null)
  const [itemsInRow, setItemsInRow] = useState(1)
  useResizeObserver(parentRef, (entry) => {
    const listWidth = entry.contentBoxSize[0].inlineSize
    const maxItemsInRow = Math.max(
      Math.floor((listWidth + ITEM_GAP) / (ITEM_SIZE + ITEM_GAP)),
      3, // minimum items in row, required to prevent generating infinite rows and crash user's device
    )

    if (itemsInRow !== maxItemsInRow) {
      setItemsInRow(maxItemsInRow)
    }
  })

  const requiredRows = Math.ceil(items.length / itemsInRow)

  const virtualizer = useVirtualizer({
    count: requiredRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_SIZE,
    overscan: 4,
    gap: ITEM_GAP,
  })

  return (
    <div className="h-full overflow-auto rounded-lg p-1" ref={parentRef}>
      <div
        className="relative w-full"
        style={{
          height: virtualizer.getTotalSize(),
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const startIdx = virtualItem.index * itemsInRow
          const blocks = items.slice(startIdx, startIdx + itemsInRow)

          return (
            <MemoizedVirtualListRow
              key={virtualItem.key}
              height={virtualItem.size}
              positionOffsetY={virtualItem.start}
              items={blocks}
              iconAtlasMetadata={iconAtlasMetadata}
              gameVersion={gameVersion}
              onItemClick={onItemClick}
              tooltipHandle={tooltipHandle}
            />
          )
        })}
      </div>

      {isLoading && (
        <div
          className="grid overflow-x-hidden"
          style={{
            gridTemplateColumns: `repeat(10, ${ITEM_SIZE}px)`,
            gap: ITEM_GAP,
          }}
        >
          {Array(10 * 10)
            .fill(0)
            .map((_, idx) => (
              <div
                key={idx}
                className="animate-pulse rounded bg-neutral-800"
                style={{
                  width: ITEM_SIZE,
                  height: ITEM_SIZE,
                }}
              />
            ))}
        </div>
      )}
    </div>
  )
}

export interface DisplaySelectDialogBase {
  items: string[]
  iconAtlasMetadata: ItemAtlasMetadataCalculated
  isLoading: boolean
  gameVersion: string
  onItemClick?: (key: string) => void
}
const DisplaySelectDialogBase: FC<DisplaySelectDialogBase> = ({
  items,
  iconAtlasMetadata,
  isLoading,
  gameVersion,
  onItemClick,
}) => {
  const tooltipHandle = useMemo(() => BaseUITooltip.createHandle<string>(), [])

  return (
    <>
      <VirtualList
        items={items}
        iconAtlasMetadata={iconAtlasMetadata ?? {}}
        isLoading={isLoading}
        gameVersion={gameVersion}
        tooltipHandle={tooltipHandle}
        onItemClick={onItemClick}
      />

      <Tooltip handle={tooltipHandle} disableHoverablePopup>
        {({ payload }) => (
          <TooltipContent side="bottom">{payload as string}</TooltipContent>
        )}
      </Tooltip>
    </>
  )
}

export default DisplaySelectDialogBase
