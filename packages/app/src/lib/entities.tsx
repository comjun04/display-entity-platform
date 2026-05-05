import type { ModelDisplayPositionKey } from '@depl/shared'

import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useHistoryStore } from '@/stores/historyStore'

import { getLogger } from './logger'

const logger = getLogger('entities')

export function setIDEntityDisplayType(
  entityId: string,
  displayType: ModelDisplayPositionKey | null,
  skipHistoryAdd = false,
) {
  const { entities, setEntityDisplayType } = useDisplayEntityStore.getState()
  const entity = entities.get(entityId)
  if (entity == null) {
    logger.error(`Invalid entity id ${entityId}`)
    return
  } else if (entity.kind !== 'item') {
    logger.error(
      `Cannot set display type for non-item display entity: ${entity.id}, kind: ${entity.kind}`,
    )
    return
  }

  const oldState = entity.display

  setEntityDisplayType(entityId, displayType)

  if (!skipHistoryAdd) {
    useHistoryStore.getState().addHistory({
      type: 'changeProperties',
      entities: [
        {
          id: entityId,
          beforeState: { kind: 'item', display: oldState },
          afterState: { kind: 'item', display: displayType },
        },
      ],
    })
  }
}
