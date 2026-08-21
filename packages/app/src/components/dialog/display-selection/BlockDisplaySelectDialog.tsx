import { skipToken, useQuery } from '@tanstack/react-query'
import { type FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/shallow'

import { useIconAtlas } from '@/hooks/useIconAtlas'
import { createNewEntities } from '@/lib/entities'
import { getBlockListQueryFn } from '@/lib/queries/getBlockList'
import { useDialogStore } from '@/stores/dialogStore'
import { useProjectStore } from '@/stores/projectStore'

import { Input } from '../../ui/input'
import Dialog from '../Dialog'
import DisplaySelectDialogBase from './DisplaySelectDialogBase'

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

  const handleItemClick = useCallback(
    (key: string) => {
      createNewEntities([{ kind: 'block', type: key }]).catch(console.error)
      closeActiveDialog()
    },
    [closeActiveDialog],
  )

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

      <DisplaySelectDialogBase
        items={searchResult}
        iconAtlasMetadata={iconAtlasMetadata ?? {}}
        isLoading={isLoading}
        gameVersion={targetGameVersion}
        onItemClick={handleItemClick}
      />
    </Dialog>
  )
}

export default BlockDisplaySelectDialog
