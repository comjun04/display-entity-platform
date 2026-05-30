import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'

export function copySelectedEntities() {
  const { entities, selectedEntityIds } = useDisplayEntityStore.getState()
  const selectedEntities = selectedEntityIds
    .map((id) => entities.get(id))
    .filter((entity) => entity != null)

  useEditorStore.getState().clipboard.setData(selectedEntities)
}
