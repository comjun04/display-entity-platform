import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'

import { createNewEntities } from './entities'
import { getLogger } from './logger'

const logger = getLogger('clipboard')

export function copySelectedEntities() {
  const { entities, selectedEntityIds } = useDisplayEntityStore.getState()
  const selectedEntities = selectedEntityIds
    .map((id) => entities.get(id))
    .filter((entity) => entity != null)

  useEditorStore.getState().clipboard.setData(selectedEntities)
}

export function pasteCopiedEntities() {
  const { data } = useEditorStore.getState().clipboard
  if (data.length < 1) {
    logger.warn('Clipboard is empty, nothing to paste')
    return
  }

  // remove `id` field because pasted entities are new entities
  // so they should get new id
  const payload = data.map((entity) => {
    const { id, ...rest } = entity
    return rest
  })

  createNewEntities(payload).catch(console.error)
}
