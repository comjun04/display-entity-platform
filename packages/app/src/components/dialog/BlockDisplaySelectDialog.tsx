import { useResizeObserver } from '@react-hookz/web'
import { skipToken, useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type FC, useEffect, useState } from 'react'
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
  const closeActiveDialog = useDialogStore((state) => state.closeActiveDialog)

  const [parentRef, setParentRef] = useState<HTMLDivElement | null>(null)

  const [itemsInRow, setItemsInRow] = useState(1)
  useResizeObserver(parentRef, (entry) => {
    const listWidth = entry.contentBoxSize[0].inlineSize
    const maxItemsInRow = Math.floor(
      (listWidth + ITEM_GAP) / (ITEM_SIZE + ITEM_GAP),
    )

    if (itemsInRow !== maxItemsInRow) {
      setItemsInRow(maxItemsInRow)
    }
  })

  const requiredRows = Math.ceil(items.length / itemsInRow)

  const virtualizer = useVirtualizer({
    count: isLoading ? 15 : requiredRows,
    getScrollElement: () => parentRef,
    estimateSize: () => ITEM_SIZE,
    overscan: 5,
    gap: ITEM_GAP,
  })

  return (
    <div
      className="h-full overflow-auto rounded-lg p-1"
      ref={(element) => setParentRef(element)}
    >
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
            <div
              key={virtualItem.key}
              className="absolute top-0 left-0 mx-auto flex flex-row"
              style={{
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`,

                gap: ITEM_GAP,
              }}
            >
              {blocks.map((block) => {
                const { xOffset, yOffset } = iconAtlasMetadata[block]
                return (
                  <Tooltip key={block}>
                    <TooltipTrigger
                      delay={0}
                      render={
                        <button
                          className="relative rounded border-2 border-transparent bg-neutral-800 text-center text-xs break-all transition duration-100 hover:border-yellow-400"
                          style={{
                            width: ITEM_SIZE,
                            height: ITEM_SIZE,
                          }}
                          onClick={() => {
                            createNewEntities([
                              { kind: 'block', type: block },
                            ]).catch(console.error)
                            closeActiveDialog()
                          }}
                        >
                          <div
                            className="absolute top-1/2 left-1/2 h-16 w-16 -translate-1/2 scale-90"
                            style={{
                              backgroundImage: `url(${CDNBaseUrl}/${gameVersion}/assets/minecraft/icon-atlas.png)`,
                              backgroundPositionX: -xOffset,
                              backgroundPositionY: -yOffset,
                            }}
                          />
                        </button>
                      }
                    />
                    <TooltipContent side="bottom">{block}</TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          )
        })}

        {isLoading && (
          <div className="flex flex-col gap-1">
            {Array(15)
              .fill(0)
              .map((_, idx) => (
                <div
                  key={idx}
                  className="h-6 w-full animate-pulse rounded-lg bg-neutral-700/70"
                />
              ))}
          </div>
        )}
      </div>
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

  const { data: iconAtlasMetadata, isLoading: iconAtlasMetadataLoading } =
    useIconAtlas(targetGameVersion)

  const isLoading = blocksListLoading || iconAtlasMetadataLoading

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
    </Dialog>
  )
}

export default BlockDisplaySelectDialog
