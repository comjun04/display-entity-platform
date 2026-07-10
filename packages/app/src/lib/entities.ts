import type { ModelDisplayPositionKey, Number3Tuple } from '@depl/shared'

import {
  type CreateNewEntityActionParam,
  useDisplayEntityStore,
} from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import type {
  DeepPartial,
  PartialNumber3Tuple,
  PlayerHeadProperties,
  TextDisplayEntity,
} from '@/types/base'
import { isItemDisplayPlayerHead } from '@/types/guards'

import { getLogger } from './logger'

const logger = getLogger('entities')

export async function createNewEntities(
  params: CreateNewEntityActionParam[],
  skipHistoryAdd = false,
) {
  const { createNew } = useDisplayEntityStore.getState()
  const createdEntities = await createNew(params)

  if (!skipHistoryAdd) {
    useHistoryStore.getState().addHistory({
      type: 'createEntities',
      beforeState: {},
      afterState: { entities: createdEntities },
    })
  }
}

export function cloneSelectedEntities() {
  const { cloneSelected } = useDisplayEntityStore.getState()
  const clonedEntities = cloneSelected()

  useHistoryStore.getState().addHistory({
    type: 'createEntities',
    beforeState: {},
    afterState: { entities: clonedEntities },
  })
}

export function batchSetEntityTransformation(
  data: {
    id: string
    translation?: PartialNumber3Tuple
    rotation?: PartialNumber3Tuple
    scale?: PartialNumber3Tuple
  }[],
  skipHistoryAdd = false,
) {
  const { entities, selectedEntityIds, batchSetEntityTransformation } =
    useDisplayEntityStore.getState()

  batchSetEntityTransformation(data)

  const selectedEntityChanged = data.some((item) => {
    if (!selectedEntityIds.includes(item.id)) return false

    const entity = entities.get(item.id)
    if (entity == null) return false

    return (
      item.translation != null || item.rotation != null || item.scale != null
    )
  })
  if (selectedEntityChanged) {
    useEditorStore
      .getState()
      .transformControl.setSelectedEntitiesTransformationUpdateFlag(true)
  }

  if (!skipHistoryAdd) {
    const historyData = data
      .map((item) => {
        const entity = entities.get(item.id)
        if (entity == null) return

        const afterStatePosition =
          item.translation != null
            ? ([
                item.translation[0] ?? entity.position[0],
                item.translation[1] ?? entity.position[1],
                item.translation[2] ?? entity.position[2],
              ] satisfies Number3Tuple)
            : undefined
        const afterStateRotation =
          item.rotation != null
            ? ([
                item.rotation[0] ?? entity.rotation[0],
                item.rotation[1] ?? entity.rotation[1],
                item.rotation[2] ?? entity.rotation[2],
              ] satisfies Number3Tuple)
            : undefined
        const afterStateScale =
          item.scale != null
            ? ([
                item.scale[0] ?? entity.size[0],
                item.scale[1] ?? entity.size[1],
                item.scale[2] ?? entity.size[2],
              ] satisfies Number3Tuple)
            : undefined

        return {
          id: item.id,
          beforeState: {
            kind: entity.kind,
            position: entity.position,
            rotation: entity.rotation,
            size: entity.size,
          },
          afterState: {
            kind: entity.kind,
            position: afterStatePosition,
            rotation: afterStateRotation,
            size: afterStateScale,
          },
        }
      })
      .filter((item) => item != null)

    useHistoryStore.getState().addHistory({
      type: 'changeProperties',
      entities: historyData,
    })
  }
}

export function setEntityNBT(
  entityId: string,
  nbt: string,
  skipHistoryAdd = false,
) {
  const { entities } = useDisplayEntityStore.getState()
  const entity = entities.get(entityId)
  if (entity == null) {
    logger.error(`Invalid entity id ${entityId}`)
    return
  }

  useDisplayEntityStore.getState().setEntityNBT(entityId, nbt)

  if (!skipHistoryAdd) {
    useHistoryStore.getState().addHistory({
      type: 'changeProperties',
      entities: [
        {
          id: entity.id,
          beforeState: { kind: entity.kind, nbt: entity.nbt },
          afterState: { kind: entity.kind, nbt },
        },
      ],
    })
  }
}

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
          oldState.textEffects = { ...entity.textEffects } // copy object because `entity` is immutable
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
    logger.error(`Invalid entity id ${entityId}`)
    return
  } else if (!isItemDisplayPlayerHead(entity)) {
    logger.error(`Cannot set player_head properties on non player_head display`)
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

export function setGroupName(
  entityId: string,
  name: string,
  skipHistoryAdd = false,
) {
  const { entities, setGroupName } = useDisplayEntityStore.getState()

  const entity = entities.get(entityId)
  if (entity == null || entity.kind !== 'group') {
    logger.error(`setGroupName(): Entity ${entityId} is not a group`)
    return
  }

  setGroupName(entityId, name)

  if (!skipHistoryAdd) {
    useHistoryStore.getState().addHistory({
      type: 'changeProperties',
      entities: [
        {
          id: entityId,
          beforeState: { kind: 'group', name: entity.name },
          afterState: { kind: 'group', name },
        },
      ],
    })
  }
}

export function deleteEntities(entityIds: string[], skipHistoryAdd = false) {
  const { deleteEntities } = useDisplayEntityStore.getState()

  const deletedEntities = deleteEntities(entityIds)

  if (!skipHistoryAdd) {
    useHistoryStore.getState().addHistory({
      type: 'deleteEntities',
      beforeState: { entities: deletedEntities },
      afterState: {},
    })
  }
}

export function groupEntities(
  targetEntityIds: string[],
  skipHistoryAdd = false,
) {
  const { entities, groupEntities } = useDisplayEntityStore.getState()

  const targetEntities = targetEntityIds.map((id) => entities.get(id)!)

  const firstEntityParentId = targetEntities[0].parent
  if (!targetEntities.every((e) => e.parent === firstEntityParentId)) {
    logger.error('Cannot group entities with different parent')
    return
  }

  const result = groupEntities(targetEntityIds)
  if (result == null) return

  if (!skipHistoryAdd) {
    useHistoryStore.getState().addHistory({
      type: 'group',
      parentGroupId: result.groupId,
      childrenEntityIds: targetEntityIds,
    })
  }
}

export function ungroupEntityGroup(groupId: string, skipHistoryAdd = false) {
  const { entities, ungroupEntityGroup } = useDisplayEntityStore.getState()

  const selectedEntityGroup = entities.get(groupId)
  if (selectedEntityGroup?.kind !== 'group') {
    logger.error(
      `Selected entity ${groupId} is not a group but ${selectedEntityGroup?.kind}`,
    )
    return
  }

  ungroupEntityGroup(groupId)

  if (!skipHistoryAdd) {
    useHistoryStore.getState().addHistory({
      type: 'ungroup',
      parentGroupId: groupId,
      childrenEntityIds: selectedEntityGroup.children,
    })
  }
}
