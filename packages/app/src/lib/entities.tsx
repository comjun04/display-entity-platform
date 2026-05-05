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
          beforeState: { kind: entity.kind, display: oldState },
          afterState: { kind: entity.kind, display: displayType },
        },
      ],
    })
  }
}

export function setBDEntityBlockstates(
  entityId: string,
  blockstates: Record<string, string>,
  skipHistoryAdd = false,
) {
  // 변경할 게 없으면 그냥 종료
  if (Object.keys(blockstates).length < 1) {
    return
  }

  const { entities, setBDEntityBlockstates } = useDisplayEntityStore.getState()

  const entity = entities.get(entityId)
  if (entity == null) {
    logger.error(`Invalid entity id ${entityId}`)
    return
  } else if (entity.kind !== 'block') {
    logger.error(
      `Cannot set blockstates for non-block display entity: ${entityId}, kind: ${entity.kind}`,
    )
    return
  }

  const oldState = entity.blockstates

  setBDEntityBlockstates(entityId, blockstates)

  if (!skipHistoryAdd) {
    useHistoryStore.getState().addHistory({
      type: 'changeProperties',
      entities: [
        {
          id: entityId,
          beforeState: { kind: entity.kind, blockstates: oldState },
          afterState: { kind: entity.kind, blockstates },
        },
      ],
    })
  }
}
