import { skipToken, useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/shallow'

import { createNewEntities } from '@/lib/entities'
import { getItemListQueryFn } from '@/lib/queries/getItemList'
import { useDialogStore } from '@/stores/dialogStore'
import { useProjectStore } from '@/stores/projectStore'

import { Input } from '../ui/input'
import Dialog from './Dialog'

interface VirtualListProps {
  items: string[]
  isLoading: boolean
}
const VirtualList: FC<VirtualListProps> = ({
  items: virtualItemList,
  isLoading,
}) => {
  const closeActiveDialog = useDialogStore((state) => state.closeActiveDialog)

  // virtualizing
  const [parentRef, setParentRef] = useState<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: isLoading ? 15 : virtualItemList.length,
    getScrollElement: () => parentRef,
    estimateSize: () => 24,
    overscan: 10,
    gap: 4,
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
          const item = virtualItemList[virtualItem.index]
          return (
            <button
              key={virtualItem.key}
              className="absolute top-0 left-0 w-full rounded-lg bg-neutral-700 p-1 text-center text-xs transition duration-150 hover:bg-neutral-700/50"
              style={{
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              onClick={() => {
                createNewEntities([{ kind: 'item', type: item }]).catch(
                  console.error,
                )
                closeActiveDialog()
              }}
            >
              {item}
            </button>
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

const ItemDisplaySelectDialog: FC = () => {
  const { t } = useTranslation()

  const [firstOpened, setFirstOpened] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { isOpen, closeActiveDialog } = useDialogStore(
    useShallow((state) => ({
      isOpen: state.activeDialog === 'itemDisplaySelect',
      closeActiveDialog: state.closeActiveDialog,
    })),
  )
  const targetGameVersion = useProjectStore((state) => state.targetGameVersion)

  const { data: itemListResponse, isLoading } = useQuery({
    queryKey: ['items.json', targetGameVersion],
    queryFn: firstOpened ? getItemListQueryFn : skipToken,
    staleTime: Infinity,
  })

  const items = itemListResponse?.items ?? []

  useEffect(() => {
    if (isOpen) {
      setFirstOpened(true)
    }
  }, [isOpen])

  // search filtering
  const searchResult = items.filter((item) => item.includes(searchQuery))

  return (
    <Dialog
      title={t(($) => $.dialog.itemDisplaySelect.title)}
      open={isOpen}
      onClose={closeActiveDialog}
    >
      <div className="flex flex-row items-center gap-4">
        <span>{t(($) => $.dialog.itemDisplaySelect.search.label)}</span>
        <Input
          value={searchQuery}
          onChange={(evt) => setSearchQuery(evt.target.value)}
        />
      </div>

      <VirtualList items={searchResult} isLoading={isLoading} />
    </Dialog>
  )
}

export default ItemDisplaySelectDialog
