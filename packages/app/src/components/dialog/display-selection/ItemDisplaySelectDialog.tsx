import { skipToken, useQuery } from '@tanstack/react-query'
import { type FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/shallow'

import { useIconAtlas } from '@/hooks/useIconAtlas'
import { createNewEntities } from '@/lib/entities'
import { getItemListQueryFn } from '@/lib/queries/getItemList'
import { useDialogStore } from '@/stores/dialogStore'
import { useProjectStore } from '@/stores/projectStore'

import { Input } from '../../ui/input'
import Dialog from '../Dialog'
import DisplaySelectDialogBase from './DisplaySelectDialogBase'

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

  const { data: iconAtlasMetadata } = useIconAtlas(targetGameVersion)

  useEffect(() => {
    if (isOpen) {
      setFirstOpened(true)
    }
  }, [isOpen])

  // search filtering
  const searchResult = items.filter((item) => item.includes(searchQuery))

  const handleItemClick = useCallback(
    (key: string) => {
      createNewEntities([{ kind: 'item', type: key }]).catch(console.error)
      closeActiveDialog()
    },
    [closeActiveDialog],
  )

  return (
    <Dialog
      title={t(($) => $.dialog.itemDisplaySelect.title)}
      open={isOpen}
      onClose={closeActiveDialog}
    >
      <div className="flex flex-row items-center gap-4">
        <span className="flex-none">
          {t(($) => $.dialog.itemDisplaySelect.search.label)}
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

export default ItemDisplaySelectDialog
