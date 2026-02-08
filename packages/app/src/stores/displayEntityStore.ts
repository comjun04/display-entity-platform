import { cloneDeep, merge } from 'lodash-es'
import { nanoid } from 'nanoid'
import { Box3, Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { getBlockList } from '@/queries/getBlockList'
import { getItemList } from '@/queries/getItemList'
import { getLogger } from '@/services/loggerService'
import { preloadResources } from '@/services/resources/preload'
import type {
  BDEngineSaveData,
  BDEngineSaveDataItem,
  BlockDisplayEntity,
  DeepPartial,
  DisplayEntity,
  DisplayEntityGroup,
  DisplayEntitySaveDataItem,
  ItemDisplayEntity,
  ModelDisplayPositionKey,
  Number3Tuple,
  PartialNumber3Tuple,
  PlayerHeadProperties,
  TextDisplayEntity,
  TextureValue,
} from '@/types'
import { isItemDisplayPlayerHead } from '@/types'

import { useEditorStore } from './editorStore'
import { useEntityRefStore } from './entityRefStore'
import { useHistoryStore } from './historyStore'
import { useProjectStore } from './projectStore'

const logger = getLogger('displayEntityStore')

const ENTITY_ID_LENGTH = 16

/**
 * 새로운 id를 생성합니다.
 * @param idUsabiityCheckPredicate id가 사용 가능한지 판별하는 함수. 중복값을 걸러내야 할 때 등에 사용할 수 있습니다.
 * 지정하지 않을 경우 생성된 id를 항상 사용 가능하다고 판별합니다.
 * @returns 새로 생성된 id
 */
const generateId = (
  length: number,
  idUsabiityCheckPredicate: (id: string) => boolean = () => true,
) => {
  const id = nanoid(length)
  if (!idUsabiityCheckPredicate(id)) {
    return generateId(length, idUsabiityCheckPredicate)
  }

  return id
}

// player_head type guard
function isCreateNewEntityActionParamIsPlayerHead(
  param: CreateNewEntityActionParam,
): param is Pick<
  ItemDisplayEntity & {
    type: 'player_head'
    playerHeadProperties: PlayerHeadProperties
  },
  'kind' | 'type' | 'playerHeadProperties'
> &
  Partial<Omit<ItemDisplayEntity, 'kind' | 'type'>> {
  if (param.kind !== 'item') return false
  else if (param.type !== 'player_head') return false
  return true
}

type CreateNewEntityActionParam =
  | (Pick<BlockDisplayEntity, 'kind' | 'type'> &
      Partial<Omit<BlockDisplayEntity, 'kind' | 'type'>>)
  | (Pick<ItemDisplayEntity, 'kind' | 'type'> &
      Partial<Omit<ItemDisplayEntity, 'kind' | 'type'>>)
  | (Pick<TextDisplayEntity, 'kind' | 'text'> &
      Partial<Omit<TextDisplayEntity, 'kind' | 'text'>>)
  | (Pick<DisplayEntityGroup, 'kind' | 'children'> &
      Partial<Omit<DisplayEntityGroup, 'kind' | 'children'>>)

export type DisplayEntityState = {
  entities: Map<string, DisplayEntity>
  selectedEntityIds: string[] // currently selected entity ids
  // currently selected entity ids, and its parents (recursive all the way up to the root)
  // required for ObjectPanel > ObjectItem child (reverse) selection tracking
  selectedEntityIdsIncludingParent: Set<string>

  /**
   * 새로운 디스플레이 엔티티를 생성합니다.
   * @param kind 디스플레이 엔티티의 종류. `block`, `item` 혹은 `text`
   * @param typeOrText `kind`가 `block` 또는 `item`일 경우 블록/아이템 id, `text`일 경우 입력할 텍스트 (JSON Format)
   * @returns 생성된 디스플레이 엔티티 데이터 id
   */
  createNew: (
    params: CreateNewEntityActionParam[],
    skipHistoryAdd?: boolean,
  ) => void

  setSelected: (ids: string[]) => void
  addToSelected: (id: string) => void
  duplicateSelected: () => void

  batchSetEntityTransformation: (
    data: {
      id: string
      translation?: PartialNumber3Tuple
      rotation?: PartialNumber3Tuple
      scale?: PartialNumber3Tuple
    }[],
    skipHistoryAdd?: boolean,
  ) => void
  setEntityDisplayType: (
    id: string,
    display: ModelDisplayPositionKey | null,
    skipHistoryAdd?: boolean,
  ) => void
  setBDEntityBlockstates: (
    id: string,
    blockstates: Record<string, string>,
    skipHistoryAdd?: boolean,
  ) => void
  setTextDisplayProperties: (
    id: string,
    properties: DeepPartial<
      Omit<
        TextDisplayEntity,
        'id' | 'kind' | 'position' | 'rotation' | 'size' | 'parent'
      >
    >,
    skipHistoryAdd?: boolean,
  ) => void
  setItemDisplayPlayerHeadProperties: (
    entityId: string,
    data: PlayerHeadProperties,
    skipHistoryAdd?: boolean,
  ) => void
  paintItemDisplayPlayerHeadTexture: (
    entityId: string,
    color: number,
    x: number,
    y: number,
  ) => void
  setGroupName: (entityId: string, name: string) => void
  deleteEntities: (entityIds: string[], skipHistoryAdd?: boolean) => void

  bulkImport: (items: DisplayEntitySaveDataItem[]) => Promise<void>
  bulkImportFromBDE: (saveData: BDEngineSaveData) => Promise<void>
  exportAll: () => DisplayEntitySaveDataItem[]

  clearEntities: () => void
  purgeInvalidEntities: () => Promise<void>

  groupEntities: (
    entityIds: string[],
    groupIdToSet?: string,
    skipHistoryAdd?: boolean,
  ) => void
  ungroupEntityGroup: (entityGroupId: string, skipHistoryAdd?: boolean) => void
}

export const useDisplayEntityStore = create(
  immer<DisplayEntityState>((set, get) => ({
    entities: new Map(),
    selectedEntityIds: [],
    selectedEntityIdsIncludingParent: new Set(),

    createNew: (params, skipHistoryAdd) => {
      const entityIds: string[] = []

      set((state) => {
        for (const param of params) {
          const id = param.id ?? generateId(ENTITY_ID_LENGTH)

          if (param.kind === 'block') {
            state.entities.set(id, {
              kind: 'block',
              id,
              type: param.type,
              parent: param.parent,
              size: param.size ?? [1, 1, 1],
              position: param.position ?? [0, 0, 0],
              rotation: param.rotation ?? [0, 0, 0],
              display: param.display ?? null,
              blockstates: param.blockstates ?? {},
            })
          } else if (param.kind === 'item') {
            state.entities.set(id, {
              kind: 'item',
              id,
              type: param.type,
              parent: param.parent,
              size: param.size ?? [1, 1, 1],
              position:
                param.position ??
                (param.type === 'player_head' ? [0, 0.5, 0] : [0, 0, 0]),
              rotation: param.rotation ?? [0, 0, 0],
              display: param.display ?? null,
            })

            const entity = state.entities.get(id)!
            if (isItemDisplayPlayerHead(entity)) {
              // is player_head
              entity.playerHeadProperties =
                isCreateNewEntityActionParamIsPlayerHead(param) &&
                param.playerHeadProperties != null
                  ? param.playerHeadProperties
                  : {
                      texture: null,
                    }
            }
          } else if (param.kind === 'text') {
            state.entities.set(id, {
              kind: 'text',
              id,
              parent: param.parent,
              text: param.text,
              textColor: param.textColor ?? 0xffffffff, // #ffffffff, white
              textEffects: param.textEffects ?? {
                bold: false,
                italic: false,
                underlined: false,
                strikethrough: false,
                obfuscated: false,
              },
              size: param.size ?? [1, 1, 1],
              position: param.position ?? [0, 0, 0],
              rotation: param.rotation ?? [0, 0, 0],
              alignment: param.alignment ?? 'center',
              backgroundColor: param.backgroundColor ?? 0xff000000, // #ff000000, black
              defaultBackground: param.defaultBackground ?? false,
              lineWidth: param.lineWidth ?? 200,
              seeThrough: param.seeThrough ?? false,
              shadow: param.shadow ?? false,
              textOpacity: param.textOpacity ?? 255,
            })
          } else if (param.kind === 'group') {
            if (param.children.length < 1) {
              continue
            }

            state.entities.set(id, {
              kind: 'group',
              id,
              parent: param.parent,
              children: param.children,
              name: 'Group',
              size: param.size ?? [1, 1, 1],
              position: param.position ?? [0, 0, 0],
              rotation: param.rotation ?? [1, 1, 1],
            })
          }

          entityIds.push(id)
        }

        useEntityRefStore.getState().createEntityRefs(entityIds)

        if (!skipHistoryAdd) {
          const createdEntities = entityIds.map((id) => state.entities.get(id)!)
          useHistoryStore.getState().addHistory({
            type: 'createEntities',
            beforeState: {},
            afterState: { entities: createdEntities },
          })
        }
      })
    },
    setSelected: (ids) =>
      set((state) => {
        const allEntityIds = [...state.entities.keys()]
        const newlySelectedEntityIds = ids
          .filter((id) => state.entities.has(id))
          .sort((a, b) => allEntityIds.indexOf(a) - allEntityIds.indexOf(b))

        if (state.selectedEntityIds[0] !== newlySelectedEntityIds[0]) {
          const firstSelectedEntity = state.entities.get(
            newlySelectedEntityIds[0],
          )

          useEditorStore.getState().setSelectionBaseTransformation({
            position: firstSelectedEntity?.position,
            rotation: firstSelectedEntity?.rotation,
            size: firstSelectedEntity?.size,
          })
        }

        state.selectedEntityIds = newlySelectedEntityIds

        const f = (id: string) => {
          if (state.selectedEntityIdsIncludingParent.has(id)) {
            return
          }
          state.selectedEntityIdsIncludingParent.add(id)

          const entity = state.entities.get(id)!
          if (entity.parent != null) {
            f(entity.parent)
          }
        }
        state.selectedEntityIdsIncludingParent.clear()
        for (const id of newlySelectedEntityIds) {
          f(id)
        }
      }),
    addToSelected: (id) =>
      set((state) => {
        if (!state.selectedEntityIds.includes(id)) {
          state.selectedEntityIds.push(id)
        }

        const f = (id: string) => {
          if (state.selectedEntityIdsIncludingParent.has(id)) {
            return
          }
          state.selectedEntityIdsIncludingParent.add(id)

          const entity = state.entities.get(id)!
          if (entity.parent != null) {
            f(entity.parent)
          }
        }
        f(id)
      }),
    duplicateSelected: () =>
      set((state) => {
        if (state.selectedEntityIds.length < 1) {
          return
        }

        const f = (entityId: string, newParentEntityId?: string) => {
          const entity = state.entities.get(entityId)!
          const clonedEntity = cloneDeep(entity)
          // stores cloned entity + cloned children entities
          const clonedEntitiesArr = [clonedEntity]

          // put new id to cloned entity
          clonedEntity.id = generateId(ENTITY_ID_LENGTH)

          if (newParentEntityId != null) {
            clonedEntity.parent = newParentEntityId
          }

          // create ref object and register

          // if entity is a group, clone children too
          if (clonedEntity.kind === 'group') {
            const clonedChildren = clonedEntity.children.flatMap((d) =>
              f(d, clonedEntity.id),
            )
            // set children entity id array to cloned one
            clonedEntity.children = clonedChildren.map((entity) => entity.id)

            // put cloned children entities to list
            for (const child of clonedChildren) {
              clonedEntitiesArr.push(child)
            }
          }

          return clonedEntitiesArr
        }

        const clonedEntities = state.selectedEntityIds.flatMap((entityId) =>
          f(entityId),
        )
        clonedEntities.forEach((newEntity) => {
          state.entities.set(newEntity.id, newEntity)
        })
        useEntityRefStore
          .getState()
          .createEntityRefs(clonedEntities.map((e) => e.id))

        useHistoryStore.getState().addHistory({
          type: 'createEntities',
          beforeState: {},
          afterState: { entities: clonedEntities },
        })
      }),
    batchSetEntityTransformation: (data, skipHistoryAdd) =>
      set((state) => {
        logger.debug('batchSetEntityTransformation', data)

        const positionChanges = new Map<
          string,
          { beforeState: Number3Tuple; afterState: Number3Tuple }
        >()
        const rotationChanges = new Map<
          string,
          { beforeState: Number3Tuple; afterState: Number3Tuple }
        >()
        const scaleChanges = new Map<
          string,
          { beforeState: Number3Tuple; afterState: Number3Tuple }
        >()

        const { selectedEntityIds } = state
        let shouldUpdateTransformControlSelectedEntitiesData = false

        let hasChanges = false

        data.forEach((item) => {
          const entity = state.entities.get(item.id)
          if (entity == null) return

          if (item.translation != null) {
            const positionDraft = entity.position.slice() as Number3Tuple
            item.translation.forEach((d, idx) => {
              if (d != null) {
                positionDraft[idx] = d
              }
            })

            positionChanges.set(item.id, {
              beforeState: entity.position.slice() as Number3Tuple,
              afterState: positionDraft,
            })

            entity.position = positionDraft
            hasChanges = true
          }
          if (item.rotation != null) {
            const rotationDraft = entity.rotation.slice() as Number3Tuple
            item.rotation.forEach((d, idx) => {
              if (d != null) {
                rotationDraft[idx] = d
              }
            })

            rotationChanges.set(item.id, {
              beforeState: entity.rotation.slice() as Number3Tuple,
              afterState: rotationDraft,
            })

            entity.rotation = rotationDraft
            hasChanges = true
          }
          if (item.scale != null) {
            const scaleDraft = entity.size.slice() as Number3Tuple
            item.scale.forEach((d, idx) => {
              if (d != null) {
                scaleDraft[idx] = d
              }
            })

            scaleChanges.set(item.id, {
              beforeState: entity.size.slice() as Number3Tuple,
              afterState: scaleDraft,
            })

            entity.size = scaleDraft
            hasChanges = true
          }

          if (
            !shouldUpdateTransformControlSelectedEntitiesData &&
            hasChanges &&
            selectedEntityIds.includes(item.id)
          ) {
            // set update flag when this entity is selected and has entity transformation changes
            shouldUpdateTransformControlSelectedEntitiesData = true
          }
        })

        if (shouldUpdateTransformControlSelectedEntitiesData) {
          useEditorStore
            .getState()
            .transformControl.setSelectedEntitiesTransformationUpdateFlag(true)
        }

        if (!skipHistoryAdd) {
          const { entities } = get()
          const records = data.map(({ id }) => {
            const positionChange = positionChanges.get(id)
            const rotationChange = rotationChanges.get(id)
            const scaleChange = scaleChanges.get(id)

            const { kind } = entities.get(id)!
            const beforeState: Pick<DisplayEntity, 'kind'> &
              Partial<Pick<DisplayEntity, 'position' | 'rotation' | 'size'>> = {
              kind,
            }
            const afterState: Pick<DisplayEntity, 'kind'> &
              Partial<Pick<DisplayEntity, 'position' | 'rotation' | 'size'>> = {
              kind,
            }

            if (positionChange != null) {
              beforeState.position = positionChange.beforeState
              afterState.position = positionChange.afterState
            }
            if (rotationChange != null) {
              beforeState.rotation = rotationChange.beforeState
              afterState.rotation = rotationChange.afterState
            }
            if (scaleChange != null) {
              beforeState.size = scaleChange.beforeState
              afterState.size = scaleChange.afterState
            }

            return { id, beforeState, afterState }
          })

          useHistoryStore.getState().addHistory({
            type: 'changeProperties',
            entities: records,
          })
        }
      }),
    setEntityDisplayType: (id, display, skipHistoryAdd) =>
      set((state) => {
        const entity = state.entities.get(id)
        if (entity == null) {
          logger.error(
            `Attempted to set display type for unknown display entity: ${id}`,
          )
          return
        } else if (entity.kind !== 'item') {
          logger.error(
            `Attempted to set display type for non-item display entity: ${id}, kind: ${entity.kind}`,
          )
          return
        }

        if (!skipHistoryAdd) {
          useHistoryStore.getState().addHistory({
            type: 'changeProperties',
            entities: [
              {
                id,
                beforeState: { kind: entity.kind, display: entity.display },
                afterState: { kind: entity.kind, display },
              },
            ],
          })
        }

        entity.display = display
      }),
    setBDEntityBlockstates: (id, blockstates, skipHistoryAdd) => {
      // 변경할 게 없으면 그냥 종료
      if (Object.keys(blockstates).length < 1) {
        return
      }

      set((state) => {
        const entity = state.entities.get(id)
        if (entity == null) {
          logger.error(
            `Attempted to set blockstates for unknown block display entity: ${id}`,
          )
          return
        } else if (entity.kind !== 'block') {
          logger.error(
            `Attempted to set blockstates for non-block display entity: ${id}, kind: ${entity.kind}`,
          )
          return
        }

        if (!skipHistoryAdd) {
          const oldBlockstates = cloneDeep(entity.blockstates)
          useHistoryStore.getState().addHistory({
            type: 'changeProperties',
            entities: [
              {
                id,
                beforeState: { kind: entity.kind, blockstates: oldBlockstates },
                afterState: { kind: entity.kind, blockstates },
              },
            ],
          })
        }

        entity.blockstates = { ...entity.blockstates, ...blockstates }
      })
    },
    setTextDisplayProperties: (id, properties, skipHistoryAdd) =>
      set((state) => {
        const entity = state.entities.get(id)
        if (entity == null) {
          logger.error(
            `Attempted to set properties for unknown text displau entity: ${id}`,
          )
          return
        } else if (entity.kind !== 'text') {
          logger.error(
            `Attempted to set properties for non-text display entity: ${id}`,
          )
          return
        }

        if (
          properties.lineWidth != null &&
          // TODO: specific type check (int)
          (!isFinite(properties.lineWidth) || properties.lineWidth < 0)
        ) {
          logger.error(
            `Text Display \`lineWidth\` must be positive integer or zero, but tried to set ${properties.lineWidth} to entity ${id}`,
          )
          return
        }

        // TODO: clean up this mess
        if (!skipHistoryAdd) {
          const nonProxiedEntity = cloneDeep(entity)
          const beforeState: typeof properties = {}
          for (const key of Object.keys(properties) as Array<
            keyof typeof properties
          >) {
            if (key === 'textEffects') {
              if (properties.textEffects != null) {
                beforeState.textEffects = Object.assign(
                  {},
                  nonProxiedEntity.textEffects,
                )
                for (const key of Object.keys(beforeState.textEffects) as Array<
                  keyof (typeof properties)['textEffects']
                >) {
                  if (!(key in properties.textEffects)) {
                    delete beforeState.textEffects[key]
                  }
                }
              }
            } else {
              // copy original state values to beforeState
              // @ts-expect-error beforeState[key] keeps accepting undefined only, type mismatch
              beforeState[key] = nonProxiedEntity[key]
            }
          }
          useHistoryStore.getState().addHistory({
            type: 'changeProperties',
            entities: [
              {
                id,
                beforeState: { kind: entity.kind, ...beforeState },
                afterState: { kind: entity.kind, ...properties },
              },
            ],
          })
        }

        merge(entity, properties)
      }),
    setItemDisplayPlayerHeadProperties: (entityId, data, skipHistoryAdd) =>
      set((state) => {
        const entity = state.entities.get(entityId)
        if (entity == null) {
          console.error(
            `Attempted to set player_head properties on entity which does not exist: ${entityId}`,
          )
          return
        } else if (!isItemDisplayPlayerHead(entity)) {
          console.error(
            `Attempted to set player_head properties on non player_head display`,
          )
          return
        }

        if (!skipHistoryAdd) {
          useHistoryStore.getState().addHistory({
            type: 'changeProperties',
            entities: [
              {
                id: entityId,
                beforeState: {
                  kind: entity.kind,
                  playerHeadProperties: cloneDeep(entity.playerHeadProperties),
                },
                afterState: { kind: entity.kind, playerHeadProperties: data },
              },
            ],
          })
        }

        entity.playerHeadProperties = data
      }),
    paintItemDisplayPlayerHeadTexture: (entityId, color, x, y) => {
      if (x < 0 || x >= 64) {
        console.error(`x must be 0 ~ 63 but got ${x}`)
        return
      } else if (y < 0 || y >= 64) {
        console.error(`y must be 0 ~ 63 but got ${y}`)
        return
      }

      set((state) => {
        const entity = state.entities.get(entityId)
        if (entity == null) {
          console.error(
            `Attempted to set player_head properties on entity which does not exist: ${entityId}`,
          )
          return
        } else if (!isItemDisplayPlayerHead(entity)) {
          console.error(
            `Attempted to set player_head properties on non player_head display`,
          )
          return
        } else if (entity.playerHeadProperties.texture?.baked !== false) {
          console.error(
            'This method must be used on player_head item display entity with unbaked texture',
          )
          return
        }

        const r = (color >>> 16) & 0xff
        const g = (color >>> 8) & 0xff
        const b = color & 0xff

        const idx = (y * 64 + x) * 4
        entity.playerHeadProperties.texture.paintTexturePixels.splice(
          idx,
          4,
          r,
          g,
          b,
          255,
        )
      })
    },
    setGroupName: (entityId, name) =>
      set((state) => {
        const entity = state.entities.get(entityId)
        if (entity == null || entity.kind !== 'group') {
          logger.error(`setGroupName(): Entity ${entityId} is not a group`)
          return
        }

        entity.name = name
      }),
    deleteEntities: (entityIds, skipHistoryAdd) =>
      set((state) => {
        const deletePendingEntityIds = new Set<string>()

        const recursivelyFlagForDeletion = (
          ids: string[],
          excludeChildren?: boolean,
        ) => {
          for (const id of ids) {
            // 이미 삭제 대상인 entity일 경우 스킵
            // 이 entity의 parent entity가 삭제 대상이라 이미 처리한 경우임
            if (deletePendingEntityIds.has(id)) continue

            const entity = state.entities.get(id)
            if (entity == null) {
              logger.error(
                `deleteEntities(): Attempt to remove unknown entity with id ${id}`,
              )
              continue
            }

            // parent가 있을 경우 parent entity에서 children으로 등록된 걸 삭제
            if (entity.parent != null) {
              const parentElement = state.entities.get(entity.parent)
              if (parentElement != null && parentElement.kind === 'group') {
                const idx = parentElement.children.findIndex((d) => d === id)
                if (idx >= 0) {
                  parentElement.children.splice(idx, 1)
                }
                // parent entity의 children이 더 이상 없을 경우 같이 삭제
                if (parentElement.children.length < 1) {
                  recursivelyFlagForDeletion([parentElement.id], true)
                }
              }
            }

            // children으로 등록된 entity들이 있다면 같이 삭제
            if (entity.kind === 'group' && !excludeChildren) {
              // children entity에서 parent entity의 children id 배열을 건드릴 경우 for ... of 배열 순환에 문제가 생김
              // index가 하나씩 앞으로 당겨지면서 일부 엔티티가 삭제 처리가 안됨
              recursivelyFlagForDeletion(entity.children.slice())
            }

            deletePendingEntityIds.add(id)
          }
        }

        recursivelyFlagForDeletion(entityIds)

        useEntityRefStore
          .getState()
          .deleteEntityRefs([...deletePendingEntityIds.values()])

        // add history
        if (!skipHistoryAdd) {
          // get the non-proxied entities
          const { entities } = get()
          const deletedEntities = [...deletePendingEntityIds].map(
            (id) => entities.get(id)!,
          )
          useHistoryStore.getState().addHistory({
            type: 'deleteEntities',
            beforeState: { entities: deletedEntities },
            afterState: {},
          })
        }

        for (const entityIdToDelete of deletePendingEntityIds) {
          state.entities.delete(entityIdToDelete)
        }
        state.selectedEntityIds = state.selectedEntityIds.filter(
          (entityId) => !deletePendingEntityIds.has(entityId),
        )
      }),

    bulkImport: async (items) => {
      const { createEntityRefs } = useEntityRefStore.getState()

      const entities = new Map<string, DisplayEntity>()

      const tempMatrix4 = new Matrix4()
      const tempPositionVec = new Vector3()
      const tempScaleVec = new Vector3()
      const tempQuaternion = new Quaternion()
      const tempEuler = new Euler()

      const f: (
        itemList: DisplayEntitySaveDataItem[],
        parentEntityId?: string,
      ) => string[] = (itemList, parentEntityId) => {
        return itemList.map((item) => {
          const id = nanoid(16)

          tempMatrix4.fromArray(item.transforms)
          tempMatrix4.decompose(tempPositionVec, tempQuaternion, tempScaleVec)
          const position = tempPositionVec.toArray()
          const scale = tempScaleVec.toArray()
          tempEuler.setFromQuaternion(tempQuaternion)
          const rotation = [
            tempEuler.x,
            tempEuler.y,
            tempEuler.z,
          ] satisfies Number3Tuple

          if (item.kind === 'group') {
            const children = item.children ?? []
            const childrenIds = f(children, id)

            // savedata v4 -> v5
            // set group name to `Group` if not exist
            const groupName = item.name ?? 'Group'

            entities.set(id, {
              kind: 'group',
              id,
              position,
              rotation,
              size: scale,
              children: childrenIds,
              parent: parentEntityId,
              name: groupName,
            })
          } else if (item.kind === 'block') {
            // blockstate가 없을 경우 empty string을 key로 사용하게 되어 들어가게 되므로 빼주기
            const blockstatesCopy = Object.assign({}, item.blockstates)
            delete blockstatesCopy['']

            entities.set(id, {
              kind: 'block',
              id,
              type: item.type,
              position,
              rotation,
              size: scale,
              parent: parentEntityId,
              blockstates: item.blockstates,
              display: item.display,
            })
          } else if (item.kind === 'item') {
            entities.set(id, {
              kind: 'item',
              id,
              type: item.type,
              position,
              rotation,
              size: scale,
              parent: parentEntityId,
              display: item.display,
            })

            const entity = entities.get(id)!
            if (isItemDisplayPlayerHead(entity)) {
              if ('playerHeadProperties' in item) {
                // is player_head
                entity.playerHeadProperties =
                  item.playerHeadProperties as PlayerHeadProperties

                // savedata v5 -> v6
                const { texture: textureData } = entity.playerHeadProperties
                if (
                  textureData?.baked === false &&
                  textureData.paintTexturePixels == null
                ) {
                  entity.playerHeadProperties.texture = null
                }
              } else {
                // savedata v1 -> v2
                // fill default playerHeadProperties if not exist
                entity.playerHeadProperties = {
                  texture: null,
                }
              }
            }
          } else if (item.kind === 'text') {
            entities.set(id, {
              kind: 'text',
              id,
              position,
              rotation,
              size: scale,
              parent: parentEntityId,
              text: item.text,
              textColor: item.textColor,
              textEffects: item.textEffects,
              alignment: item.alignment,
              backgroundColor: item.backgroundColor,
              defaultBackground: item.defaultBackground,
              lineWidth: item.lineWidth,
              seeThrough: item.seeThrough,
              shadow: item.shadow,
              textOpacity: item.textOpacity,
            })
          }

          return id
        })
      }

      f(items)

      const entitiesArr = [...entities.values()]

      await preloadResources(entitiesArr)

      createEntityRefs([...entities.keys()])
      set({ entities })

      useHistoryStore.getState().clearHistory()
    },
    bulkImportFromBDE: async (saveData) => {
      const entities = new Map<string, DisplayEntity>()

      const tempMatrix4 = new Matrix4()
      const tempPositionVec = new Vector3()
      const tempScaleVec = new Vector3()
      const tempQuaternion = new Quaternion()
      const tempEuler = new Euler()

      const f: (
        items: BDEngineSaveDataItem[],
        parentEntityId?: string,
      ) => Promise<(string | null)[]> = async (items, parentEntityId) => {
        return await Promise.all(
          items.map(async (item) => {
            const id = nanoid(16)

            tempMatrix4.fromArray(item.transforms).transpose()
            tempMatrix4.decompose(tempPositionVec, tempQuaternion, tempScaleVec)
            const position = tempPositionVec.toArray()
            const scale = tempScaleVec.toArray()
            tempEuler.setFromQuaternion(tempQuaternion)
            const rotation = [
              tempEuler.x,
              tempEuler.y,
              tempEuler.z,
            ] satisfies Number3Tuple

            const itemType = item.name.split('[')[0] // block_type[some_blockstate=value,another_blockstate=value2]
            const extraDataList = item.name
              .slice(itemType.length + 1, -1)
              .split(',')
            const extraData: Record<string, string> = extraDataList.reduce(
              (acc, cur) => {
                const [k, v] = cur.split('=')
                // blockstate가 없을 경우 empty string을 key로 사용하게 되어 들어가게 되므로 빼주기
                if (k.length < 1) return acc
                return { ...acc, [k]: v }
              },
              {},
            )

            if ('isCollection' in item && item.isCollection) {
              // group

              const children = item.children ?? []
              const childrenIds = await f(children, id)

              entities.set(id, {
                kind: 'group',
                id,
                position,
                rotation,
                size: scale,
                children: childrenIds.filter((id) => id != null),
                parent: parentEntityId,
                name: item.name,
              })
            } else if ('isBlockDisplay' in item && item.isBlockDisplay) {
              // block display

              entities.set(id, {
                kind: 'block',
                id,
                type: itemType,
                position,
                rotation,
                size: scale,
                parent: parentEntityId,
                blockstates: extraData,
                display: extraData['display'] as ModelDisplayPositionKey,
              })
            } else if ('isItemDisplay' in item && item.isItemDisplay) {
              // item display

              entities.set(id, {
                kind: 'item',
                id,
                type: itemType,
                position,
                rotation,
                size: scale,
                parent: parentEntityId,
                display: extraData['display'] as ModelDisplayPositionKey,
              })

              const entity = entities.get(id)!
              if (isItemDisplayPlayerHead(entity)) {
                let textureUrl: string | undefined
                if (item.defaultTextureValue != null) {
                  const decodedTextureValue = JSON.parse(
                    atob(item.defaultTextureValue),
                  ) as TextureValue
                  textureUrl = decodedTextureValue.textures.SKIN?.url
                }

                let paintTexturePixels: number[] = []
                if (item.paintTexture != null) {
                  const canvas = document.createElement('canvas')
                  const ctx = canvas.getContext('2d')!
                  // we need to load image asynconously to ensure image data is fully loaded before processing
                  const image = await new Promise<HTMLImageElement>(
                    (resolve) => {
                      const img = new Image()
                      img.onload = () => resolve(img)
                      img.src = item.paintTexture!
                    },
                  )

                  ctx.drawImage(image, 0, 0, 64, 64)
                  const imageData = ctx.getImageData(0, 0, 64, 64)
                  paintTexturePixels = Array.from(imageData.data)
                }

                // `paintTexture` (unbaked status) takes priority when both `paintTexture` and `defaultTextureValue` set.
                entity.playerHeadProperties = {
                  texture:
                    item.paintTexture != null
                      ? {
                          baked: false,
                          paintTexturePixels,
                        }
                      : textureUrl != null
                        ? {
                            baked: true,
                            url: textureUrl,
                          }
                        : null,
                }
              }
            } else if ('isTextDisplay' in item && item.isTextDisplay) {
              // text display

              const textColorRGB = parseInt(item.options.color.slice(1), 16)
              const backgroundColorRGB = parseInt(
                item.options.backgroundColor.slice(1),
                16,
              )
              const backgroundColorARGB =
                (((item.options.backgroundColorAlpha * 255) << 24) |
                  backgroundColorRGB) >>>
                0

              entities.set(id, {
                kind: 'text',
                id,
                position,
                rotation,
                size: scale,
                parent: parentEntityId,

                text: item.name,
                textColor: textColorRGB,
                textEffects: {
                  bold: item.options.bold,
                  italic: item.options.italic,
                  underlined: item.options.underline,
                  strikethrough: item.options.strikeThrough,
                  obfuscated: item.options.obfuscated,
                },
                alignment: item.options.align,
                backgroundColor: backgroundColorARGB,
                defaultBackground: false,
                lineWidth: item.options.lineLength,
                seeThrough: false,
                shadow: false,
                textOpacity: item.options.alpha * 255,
              })
            } else {
              return null
            }

            return id
          }),
        )
      }

      // saveData[0]이 최상단 그룹으로 확인되어 이거만 처리함
      await f(saveData[0].children)

      await preloadResources([...entities.values()])

      const { createEntityRefs } = useEntityRefStore.getState()

      createEntityRefs([...entities.keys()])
      set({ entities })

      useHistoryStore.getState().clearHistory()
    },
    exportAll: () => {
      const { entities } = get()
      const { entityRefs } = useEntityRefStore.getState()

      const generateEntitySaveData: (
        entity: DisplayEntity,
      ) => DisplayEntitySaveDataItem = (entity) => {
        const refData = entityRefs.get(entity.id)!
        const transforms = refData.objectRef.current.matrix.toArray()

        if (entity.kind === 'block') {
          return {
            kind: entity.kind,
            type: entity.type,
            transforms,
            blockstates: entity.blockstates,
            display: entity.display,
          }
        } else if (entity.kind === 'item') {
          return {
            kind: entity.kind,
            type: entity.type,
            transforms,
            display: entity.display,
            playerHeadProperties:
              'playerHeadProperties' in entity
                ? entity.playerHeadProperties
                : undefined,
          }
        } else if (entity.kind === 'text') {
          return {
            kind: entity.kind,
            transforms,
            text: entity.text,
            textColor: entity.textColor,
            textEffects: entity.textEffects,
            alignment: entity.alignment,
            backgroundColor: entity.backgroundColor,
            defaultBackground: entity.defaultBackground,
            lineWidth: entity.lineWidth,
            seeThrough: entity.seeThrough,
            shadow: entity.shadow,
            textOpacity: entity.textOpacity,
          }
        } else if (entity.kind === 'group') {
          const children = entity.children.map((childrenEntityId) => {
            const e = entities.get(childrenEntityId)!
            return generateEntitySaveData(e)
          })
          return {
            kind: entity.kind,
            transforms,
            children,
            name: entity.name,
          }
        }

        // This should not happen
        throw new Error(
          `Unexpected entity kind ${(entity as DisplayEntity).kind}`,
        )
      }

      const rootEntities = [...entities.values()]
        .filter((e) => e.parent == null)
        .map((e) => generateEntitySaveData(e))

      return rootEntities
    },

    clearEntities: () =>
      set((state) => {
        state.entities.clear()
        state.selectedEntityIds = []

        useEntityRefStore.getState().clearEntityRefs()
      }),
    purgeInvalidEntities: async () => {
      // fetch blocks and items list and remove entities
      // which type is not available on current target game version

      // i know fetching without caching is shit, will fix later

      const { targetGameVersion } = useProjectStore.getState()
      const blocksListResponse = await getBlockList(targetGameVersion)
      const blocks = (blocksListResponse.blocks ?? []).map(
        (d) => d.split('[')[0],
      ) // 블록 이름 뒤에 붙는 `[up=true]` 등 blockstate 기본값 텍스트 제거

      const itemsListResponse = await getItemList(targetGameVersion)
      const items = itemsListResponse.items

      const { entities, deleteEntities } = get()

      const invalidEntityIds: string[] = []
      for (const [entityId, entity] of entities.entries()) {
        if (entity.kind === 'block' && !blocks.includes(entity.type)) {
          invalidEntityIds.push(entityId)
        } else if (entity.kind === 'item' && !items.includes(entity.type)) {
          invalidEntityIds.push(entityId)
        }
      }

      deleteEntities(invalidEntityIds, true)
    },

    groupEntities: (entityIds, groupIdToSet, skipHistoryAdd) =>
      set((state) => {
        const groupId = groupIdToSet ?? nanoid(16)

        const entities = entityIds.map((id) => state.entities.get(id)!)

        const firstEntityParentId = entities[0].parent
        if (!entities.every((e) => e.parent === firstEntityParentId)) {
          logger.error(
            'groupEntities(): cannot group entities with different parent',
          )
          return
        }

        const previousParentGroup =
          firstEntityParentId != null
            ? (state.entities.get(firstEntityParentId) as DisplayEntityGroup) // WritableDraft<DisplayEntityGroup>
            : undefined

        // box3로 그룹 안에 포함될 모든 entity들을 포함하도록 늘려서 측정
        const box3 = new Box3()
        const entityRefs = useEntityRefStore.getState().entityRefs
        for (const entity of entities) {
          const entityRefData = entityRefs.get(entity.id)!
          box3.expandByObject(entityRefData.objectRef.current)

          entity.parent = groupId
          if (previousParentGroup != null) {
            // group하기 전 엔티티가 다른 그룹에 속해 있었다면 children 목록에서 제거
            const idx = previousParentGroup.children.findIndex(
              (id) => id === entity.id,
            )
            if (idx >= 0) {
              previousParentGroup.children.splice(idx, 1)
            }
          }
        }
        for (const entity of entities) {
          entity.position[0] -= box3.min.x
          entity.position[1] -= box3.min.y
          entity.position[2] -= box3.min.z
        }

        useEntityRefStore.getState().createEntityRefs([groupId])

        state.entities.set(groupId, {
          kind: 'group',
          id: groupId,
          position: box3.min.toArray(),
          rotation: [0, 0, 0],
          size: [1, 1, 1],
          parent: firstEntityParentId,
          children: entityIds,
          name: 'Group',
        } satisfies DisplayEntityGroup)
        if (previousParentGroup != null) {
          // 새로 만들어진 그룹을 기존에 엔티티들이 있었던 그룹의 children으로 추가
          previousParentGroup.children.push(groupId)
        }

        // 선택된 디스플레이 엔티티를 방금 생성한 그룹으로 설정
        state.selectedEntityIds = [groupId]

        const f = (id: string) => {
          if (state.selectedEntityIdsIncludingParent.has(id)) {
            return
          }
          state.selectedEntityIdsIncludingParent.add(id)

          const entity = state.entities.get(id)!
          if (entity.parent != null) {
            f(entity.parent)
          }
        }
        state.selectedEntityIdsIncludingParent.clear()
        f(groupId)

        if (!skipHistoryAdd) {
          useHistoryStore.getState().addHistory({
            type: 'group',
            parentGroupId: groupId,
            childrenEntityIds: entityIds,
          })
        }
      }),
    ungroupEntityGroup: (entityGroupId, skipHistoryAdd) =>
      set((state) => {
        const selectedEntityGroup = state.entities.get(entityGroupId)
        if (selectedEntityGroup?.kind !== 'group') {
          logger.error(
            `ungroupEntityGroup(): selected entity ${entityGroupId} is not a group but ${selectedEntityGroup?.kind}`,
          )
          return
        }

        const parentEntityGroup =
          selectedEntityGroup.parent != null
            ? (state.entities.get(
                selectedEntityGroup.parent,
              ) as DisplayEntityGroup) // WritableDraft<DisplayEntityGroup>
            : undefined
        if (parentEntityGroup != null) {
          const idx = parentEntityGroup.children.findIndex(
            (id) => id === entityGroupId,
          )
          if (idx >= 0) {
            parentEntityGroup.children.splice(idx, 1)
          }
        }

        const { entityRefs } = useEntityRefStore.getState()

        const groupTransformationMatrix = entityRefs
          .get(entityGroupId)!
          .objectRef.current.matrix.clone()

        ;[...state.entities.values()]
          .filter((e) => selectedEntityGroup.children.includes(e.id))
          .forEach((e) => {
            e.parent = parentEntityGroup?.id
            if (parentEntityGroup != null) {
              parentEntityGroup.children.push(e.id)
            }

            const refData = entityRefs.get(e.id)!
            const entityInstance = refData.objectRef.current
            const newEntityMatrix = entityInstance.matrix
              .clone()
              .premultiply(groupTransformationMatrix) // entityInstance.applyMatrix4(groupTransformationMatrix)

            const newPosition = new Vector3().setFromMatrixPosition(
              newEntityMatrix,
            )
            const newRotation = new Euler().setFromRotationMatrix(
              newEntityMatrix,
            )
            const newScale = new Vector3().setFromMatrixScale(newEntityMatrix)

            e.position = newPosition.toArray()
            e.rotation = [newRotation.x, newRotation.y, newRotation.z]
            e.size = newScale.toArray()
          })

        if (!skipHistoryAdd) {
          useHistoryStore.getState().addHistory({
            type: 'ungroup',
            parentGroupId: entityGroupId,
            childrenEntityIds: selectedEntityGroup.children.slice(), // get the non-proxied array
          })
        }

        // 그룹의 children을 비우기
        // 그룹 삭제는 DisplayEntity.tsx의 useEffect()에서 수행 (그룹에 children이 비어있을 경우 삭제)
        // 여기서 먼저 삭제할 경우 그룹에 속한 엔티티들의 reparenting이 진행되기 전에 엔티티 instance가 삭제되어 버려서
        // 화면에 렌더링이 안되는 문제가 있음
        selectedEntityGroup.children = []

        // ungroup한 뒤에는 모든 선택된 엔티티들의 선택을 해제
        state.selectedEntityIds = []
      }),
  })),
)
