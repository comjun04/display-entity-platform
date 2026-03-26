import { skipToken, useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/shallow'

import { getBlockListQueryFn } from '@/lib/queries/getBlockList'
import { useDialogStore } from '@/stores/dialogStore'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useProjectStore } from '@/stores/projectStore'

import Dialog from './Dialog'

interface VirtualListProps {
  items: string[]
  isLoading: boolean
}
const VirtualList: FC<VirtualListProps> = ({
  items: virtualItemList,
  isLoading,
}) => {
  const createNewEntity = useDisplayEntityStore((state) => state.createNew)
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
          const block = virtualItemList[virtualItem.index]
          return (
            <button
              key={virtualItem.key}
              className="absolute top-0 left-0 w-full rounded-lg bg-neutral-700 p-1 text-center text-xs transition duration-150 hover:bg-neutral-700/50"
              style={{
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              onClick={() => {
                createNewEntity([{ kind: 'block', type: block }])
                closeActiveDialog()
              }}
            >
              {block}
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

  const { data: blocksListResponse, isLoading } = useQuery({
    queryKey: ['blocks.json', targetGameVersion],
    queryFn: firstOpened ? getBlockListQueryFn : skipToken,
    staleTime: Infinity,
  })
  const blocks = (blocksListResponse?.blocks ?? []).map((d) => d.split('[')[0]) // 블록 이름 뒤에 붙는 `[up=true]` 등 blockstate 기본값 텍스트 제거

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
        <span>{t(($) => $.dialog.blockDisplaySelect.search.label)}</span>
        <input
          type="text"
          className="grow rounded-sm px-2 py-1 text-sm outline-hidden"
          value={searchQuery}
          onChange={(evt) => setSearchQuery(evt.target.value)}
        />
      </div>

      <VirtualList items={searchResult} isLoading={isLoading} />
    </Dialog>
  )
}

export default BlockDisplaySelectDialog
