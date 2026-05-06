import type { ModelDisplayPositionKey } from '@depl/shared'

import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useHistoryStore } from '@/stores/historyStore'
import type {
  DeepPartial,
  PlayerHeadProperties,
  TextDisplayEntity,
} from '@/types/base'
import { isItemDisplayPlayerHead } from '@/types/guards'

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

export function setTDEntityProperties(
  entityId: string,
  properties: DeepPartial<
    Omit<
      TextDisplayEntity,
      'id' | 'kind' | 'position' | 'rotation' | 'size' | 'parent'
    >
  >,
  skipHistoryAdd = false,
) {
  const { entities, setTextDisplayProperties } =
    useDisplayEntityStore.getState()

  const entity = entities.get(entityId)
  if (entity == null) {
    logger.error(`Invalid entity id ${entityId}`)
    return
  } else if (entity.kind !== 'text') {
    logger.error(
      `Cannot set properties for non-text display entity: ${entityId}`,
    )
    return
  }

  const success = setTextDisplayProperties(entityId, properties)
  if (!success) return

  if (!skipHistoryAdd) {
    const oldState: typeof properties = {}
    for (const key of Object.keys(properties) as Array<
      keyof typeof properties
    >) {
      if (key === 'textEffects') {
        if (properties.textEffects != null) {
          oldState.textEffects = entity.textEffects
          for (const key of Object.keys(oldState.textEffects) as Array<
            keyof (typeof properties)['textEffects']
          >) {
            if (!(key in properties.textEffects)) {
              delete oldState.textEffects[key]
            }
          }
        }
      } else {
        // copy original state values to beforeState
        // @ts-expect-error beforeState[key] keeps accepting undefined only, type mismatch
        oldState[key] = entity[key]
      }
    }

    useHistoryStore.getState().addHistory({
      type: 'changeProperties',
      entities: [
        {
          id: entityId,
          beforeState: { kind: entity.kind, ...oldState },
          afterState: { kind: entity.kind, ...properties },
        },
      ],
    })
  }
}

export function setIDEntityPlayerHeadProperties(
  entityId: string,
  data: PlayerHeadProperties,
  skipHistoryAdd = false,
) {
  const { entities, setItemDisplayPlayerHeadProperties } =
    useDisplayEntityStore.getState()

  const entity = entities.get(entityId)
  if (entity == null) {
    console.error(`Invalid entity id ${entityId}`)
    return
  } else if (!isItemDisplayPlayerHead(entity)) {
    console.error(
      `Cannot set player_head properties on non player_head display`,
    )
    return
  }

  const oldState = entity.playerHeadProperties

  setItemDisplayPlayerHeadProperties(entityId, data)

  if (!skipHistoryAdd) {
    useHistoryStore.getState().addHistory({
      type: 'changeProperties',
      entities: [
        {
          id: entityId,
          beforeState: {
            kind: entity.kind,
            playerHeadProperties: oldState,
          },
          afterState: { kind: entity.kind, playerHeadProperties: data },
        },
      ],
    })
  }
}
