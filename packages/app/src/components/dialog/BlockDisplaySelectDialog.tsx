import { Tooltip as BaseUITooltip } from '@base-ui/react'
import { useResizeObserver } from '@react-hookz/web'
import { skipToken, useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type FC, memo, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/shallow'

import { CDNBaseUrl } from '@/constants'
import {
  type ItemAtlasMetadataCalculated,
  useIconAtlas,
} from '@/hooks/useIconAtlas'
import { createNewEntities } from '@/lib/entities'
import { getBlockListQueryFn } from '@/lib/queries/getBlockList'
import { useDialogStore } from '@/stores/dialogStore'
import { useProjectStore } from '@/stores/projectStore'

import { Input } from '../ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import Dialog from './Dialog'

const ITEM_SIZE = 64
const ITEM_GAP = 4

const tooltipHandle = BaseUITooltip.createHandle<string>()

interface VirtualListRowProps {
  height: number
  positionOffsetY: number

  items: string[]

  iconAtlasMetadata: ItemAtlasMetadataCalculated
  gameVersion: string
}
const VirtualListRow: FC<VirtualListRowProps> = ({
  height,
  positionOffsetY,
  items,
  iconAtlasMetadata,
  gameVersion,
}) => {
  const closeActiveDialog = useDialogStore((state) => state.closeActiveDialog)

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
          <button
            key={key}
            className="group relative rounded border-2 border-transparent bg-neutral-800 text-center text-xs break-all transition duration-100 hover:border-yellow-400"
            style={{
              width: ITEM_SIZE,
              height: ITEM_SIZE,
            }}
            onClick={() => {
              createNewEntities([{ kind: 'block', type: key }]).catch(
                console.error,
              )
              closeActiveDialog()
            }}
          >
            <TooltipTrigger
              handle={tooltipHandle}
              delay={0}
              render={
                <div
                  className="absolute top-1/2 left-1/2 flex h-16 w-16 -translate-1/2 scale-90 items-center justify-center"
                  style={{
                    backgroundImage: `url(${CDNBaseUrl}/${gameVersion}/assets/minecraft/icon-atlas.png)`,
                    backgroundPositionX: -xOffset,
                    backgroundPositionY: -yOffset,
                  }}
                />
              }
              payload={key}
            />
          </button>
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
}
const VirtualList: FC<VirtualListProps> = ({
  items,
  iconAtlasMetadata,
  isLoading,
  gameVersion,
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
    overscan: 2,
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

const BlockDisplaySelectDialog: FC = () => {
  const { t } = useTranslation()

  const [firstOpened, setFirstOpened] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { isOpen, closeActiveDialog } = useDialogStore(
    useShallow((state) => ({
      isOpen: state.activeDialog === 'blockDisplaySelect',
      closeActiveDialog: state.closeActiveDialog,
    })),
  )
  const targetGameVersion = useProjectStore((state) => state.targetGameVersion)

  const { data: blocksListResponse, isLoading: blocksListLoading } = useQuery({
    queryKey: ['blocks.json', targetGameVersion],
    queryFn: firstOpened ? getBlockListQueryFn : skipToken,
    staleTime: Infinity,
  })
  const blocks = (blocksListResponse?.blocks ?? []).map((d) => d.split('[')[0]) // 블록 이름 뒤에 붙는 `[up=true]` 등 blockstate 기본값 텍스트 제거

  const { data: iconAtlasMetadata } = useIconAtlas(targetGameVersion)

  const isLoading = blocksListLoading

  useEffect(() => {
    if (isOpen) {
      setFirstOpened(true)
    }
  }, [isOpen])

  // search filtering
  const searchResult = blocks.filter((block) => block.includes(searchQuery))

  return (
    <Dialog
      title={t(($) => $.dialog.blockDisplaySelect.title)}
      open={isOpen}
      onClose={closeActiveDialog}
    >
      <div className="flex flex-row items-center gap-4">
        <span className="flex-none">
          {t(($) => $.dialog.blockDisplaySelect.search.label)}
        </span>
        <Input
          value={searchQuery}
          onChange={(evt) => setSearchQuery(evt.target.value)}
        />
      </div>

      <VirtualList
        items={searchResult}
        iconAtlasMetadata={iconAtlasMetadata ?? {}}
        isLoading={isLoading}
        gameVersion={targetGameVersion}
      />

      <Tooltip handle={tooltipHandle} disableHoverablePopup>
        {({ payload }) => (
          <TooltipContent side="bottom">{payload as string}</TooltipContent>
        )}
      </Tooltip>
    </Dialog>
  )
}

export default BlockDisplaySelectDialog
