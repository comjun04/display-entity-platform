import { cloneDeep, merge } from 'lodash-es'
import { nanoid } from 'nanoid'
import { Box3, Euler, Vector3 } from 'three'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { getLogger } from '@/lib/logger'
import { getBlockList } from '@/lib/queries/getBlockList'
import { getItemList } from '@/lib/queries/getItemList'
import {
  calculateDefaultBlockstates,
  getMatchingBlockstateModel,
  loadBlockstates,
} from '@/lib/resources/blockstates'
import type {
  BlockDisplayEntity,
  BlockStateApplyModelInfo,
  BlockstatesData,
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
} from '@/types/base'
import { isItemDisplayPlayerHead } from '@/types/guards'

import { useEditorStore } from './editorStore'
import { useEntityRefStore } from './entityRefStore'
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

export type CreateNewEntityActionParam =
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

  instancedMeshGroup: Map<
    string,
    {
      modelResourceLocation: string
      meshes: {
        // an entity can have same model mesh more than one,
        // even with same x, y rotation thanks to the `multipart` system...
        // so we need to make separate *unique* id to check
        // (this id can contain entityId + xRot + yRot + increment, or just random id value)
        id: string
        entityId: string
        xRotation: number
        yRotation: number
      }[]
    }
  >

  /**
   * 새로운 디스플레이 엔티티를 생성합니다.
   * @param kind 디스플레이 엔티티의 종류. `block`, `item` 혹은 `text`
   * @param typeOrText `kind`가 `block` 또는 `item`일 경우 블록/아이템 id, `text`일 경우 입력할 텍스트 (JSON Format)
   * @returns 생성된 디스플레이 엔티티 데이터 id
   */
  createNew: (params: CreateNewEntityActionParam[]) => Promise<DisplayEntity[]>

  setSelected: (ids: string[]) => void
  addToSelected: (id: string) => void
  cloneSelected: () => DisplayEntity[]

  batchSetEntityTransformation: (
    data: {
      id: string
      translation?: PartialNumber3Tuple
      rotation?: PartialNumber3Tuple
      scale?: PartialNumber3Tuple
    }[],
  ) => void
  setEntityDisplayType: (
    id: string,
    display: ModelDisplayPositionKey | null,
  ) => void
  setBDEntityBlockstates: (
    id: string,
    blockstates: Record<string, string>,
  ) => void
  setTextDisplayProperties: (
    id: string,
    properties: DeepPartial<
      Omit<
        TextDisplayEntity,
        'id' | 'kind' | 'position' | 'rotation' | 'size' | 'parent'
      >
    >,
  ) => boolean
  setItemDisplayPlayerHeadProperties: (
    entityId: string,
    data: PlayerHeadProperties,
  ) => void
  paintItemDisplayPlayerHeadTexture: (
    entityId: string,
    color: number,
    x: number,
    y: number,
  ) => void
  setGroupName: (entityId: string, name: string) => void
  deleteEntities: (entityIds: string[]) => DisplayEntity[]

  bulkImport: (entities: Map<string, DisplayEntity>) => void
  exportAll: () => DisplayEntitySaveDataItem[]

  clearEntities: () => void
  purgeInvalidEntities: () => Promise<void>

  groupEntities: (
    entityIds: string[],
    groupIdToSet?: string,
  ) => { groupId: string }
  ungroupEntityGroup: (entityGroupId: string) => void
}

export const useDisplayEntityStore = create(
  immer<DisplayEntityState>((set, get) => ({
    entities: new Map(),
    selectedEntityIds: [],
    selectedEntityIdsIncludingParent: new Set(),

    instancedMeshGroup: new Map(),

    createNew: async (params) => {
      const entityIds: string[] = []

      const uniqueBlockTypes = params.reduce((acc, cur) => {
        if (cur.kind === 'block') {
          acc.add(cur.type)
        }
        return acc
      }, new Set<string>())
      const uniqueBlockTypesArr = [...uniqueBlockTypes.values()]
      const blockstatesDataLoadResults = await Promise.allSettled(
        uniqueBlockTypesArr.map((type) => loadBlockstates(type)),
      )
      const blockstatesDatas = blockstatesDataLoadResults.reduce(
        (acc, cur, idx) => {
          if (cur.status === 'rejected') {
            logger.error(
              `Failed to load blockstates data of type ${uniqueBlockTypesArr[idx]}`,
            )
          } else {
            const type = uniqueBlockTypesArr[idx]
            acc.set(type, cur.value)
          }

          return acc
        },
        new Map<string, BlockstatesData>(),
      )

      const entityCreationJobs = params
        .map<
          | {
              entity: DisplayEntity
              models: BlockStateApplyModelInfo[]
            }
          | undefined
        >((param) => {
          const id = param.id ?? generateId(ENTITY_ID_LENGTH)

          if (param.kind === 'block') {
            const blockstatesData = blockstatesDatas.get(param.type)
            if (blockstatesData == null) {
              return
            }
            const blockstates = calculateDefaultBlockstates(
              blockstatesData,
              param.blockstates,
            )
            const matchingModels = getMatchingBlockstateModel(
              blockstatesData,
              blockstates,
            )

            return {
              entity: {
                kind: 'block',
                id,
                type: param.type,
                parent: param.parent,
                size: param.size ?? [1, 1, 1],
                position: param.position ?? [0, 0, 0],
                rotation: param.rotation ?? [0, 0, 0],
                display: param.display ?? null,
                blockstates,
              },
              models: matchingModels,
            }
          } else if (param.kind === 'item') {
            return {
              entity: {
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
                playerHeadProperties:
                  param.type === 'player_head'
                    ? param.playerHeadProperties != null
                      ? param.playerHeadProperties
                      : {
                          texture: null,
                        }
                    : undefined,
              },
              models: [
                {
                  model: `item/${param.type}`,
                  x: 0,
                  y: 0,
                },
              ] satisfies BlockStateApplyModelInfo[],
            }
          } else if (param.kind === 'text') {
            return {
              entity: {
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
              },
              models: [],
            }
          } else if (param.kind === 'group') {
            if (param.children.length < 1) {
              return
            }

            return {
              entity: {
                kind: 'group',
                id,
                parent: param.parent,
                children: param.children,
                name: param.name ?? 'Group',
                size: param.size ?? [1, 1, 1],
                position: param.position ?? [0, 0, 0],
                rotation: param.rotation ?? [1, 1, 1],
              },
              models: [],
            }
          }
        })
        .filter((data) => data != null)

      set((state) => {
        for (const job of entityCreationJobs) {
          const newEntityCreationObj = job.entity
          state.entities.set(newEntityCreationObj.id, newEntityCreationObj)

          entityIds.push(newEntityCreationObj.id)

          for (const model of job.models) {
            const modelResourceLocation = model.model
            const item = state.instancedMeshGroup.get(modelResourceLocation)
            if (item != null) {
              item.meshes.push({
                id: generateId(8),
                entityId: newEntityCreationObj.id,
                xRotation: model.x ?? 0,
                yRotation: model.y ?? 0,
              })
            } else {
              state.instancedMeshGroup.set(modelResourceLocation, {
                modelResourceLocation,
                meshes: [
                  {
                    id: generateId(8),
                    entityId: newEntityCreationObj.id,
                    xRotation: model.x ?? 0,
                    yRotation: model.y ?? 0,
                  },
                ],
              })
            }
          }
        }

        useEntityRefStore.getState().createEntityRefs(entityIds)
      })

      return entityCreationJobs.map((job) => job.entity)
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
    cloneSelected: () => {
      const { entities, selectedEntityIds } = get()
      if (selectedEntityIds.length < 1) {
        return []
      }

      const f = (entityId: string, newParentEntityId?: string) => {
        const entity = entities.get(entityId)!
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

      const clonedEntities = selectedEntityIds.flatMap((entityId) =>
        f(entityId),
      )

      set((state) => {
        clonedEntities.forEach((newEntity) => {
          state.entities.set(newEntity.id, newEntity)
        })
        useEntityRefStore
          .getState()
          .createEntityRefs(clonedEntities.map((e) => e.id))
      })

      return clonedEntities
    },
    batchSetEntityTransformation: (data) =>
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
          }
        })
      }),
    setEntityDisplayType: (id, display) =>
      set((state) => {
        const entity = state.entities.get(id)
        if (entity == null) {
          logger.error(`Invalid entity id ${id}`)
          return
        } else if (entity.kind !== 'item') {
          logger.error(
            `Cannot set display type for non-item display entity: ${id}, kind: ${entity.kind}`,
          )
          return
        }

        entity.display = display
      }),
    setBDEntityBlockstates: (id, blockstates) => {
      set((state) => {
        const entity = state.entities.get(id)
        if (entity == null) {
          logger.error(`Invalid entity id ${id}`)
          return
        } else if (entity.kind !== 'block') {
          logger.error(
            `Cannot set blockstates for non-block display entity: ${id}, kind: ${entity.kind}`,
          )
          return
        }

        entity.blockstates = { ...entity.blockstates, ...blockstates }
      })
    },
    setTextDisplayProperties: (id, properties) => {
      if (
        properties.lineWidth != null &&
        // TODO: specific type check (int)
        (!isFinite(properties.lineWidth) || properties.lineWidth < 0)
      ) {
        logger.error(
          `Text Display \`lineWidth\` must be positive integer or zero, but tried to set ${properties.lineWidth} to entity ${id}`,
        )
        return false
      }

      set((state) => {
        const entity = state.entities.get(id)
        if (entity == null) {
          logger.error(`Invalid entity id ${id}`)
          return
        } else if (entity.kind !== 'text') {
          logger.error(
            `Cannot set properties for non-text display entity: ${id}`,
          )
          return
        }

        merge(entity, properties)
      })

      return true
    },
    setItemDisplayPlayerHeadProperties: (entityId, data) =>
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
    deleteEntities: (entityIds) => {
      const { entities } = get()
      const flaggedEntityIds = new Set<string>()

      const recursivelyFlagForDeletion = (
        ids: string[],
        excludeChildren?: boolean,
      ) => {
        for (const id of ids) {
          // 이미 삭제 대상인 entity일 경우 스킵
          // 이 entity의 parent entity가 삭제 대상이라 이미 처리한 경우임
          if (flaggedEntityIds.has(id)) continue

          const entity = entities.get(id)
          if (entity == null) {
            logger.error(
              `deleteEntities(): Cannot remove unknown entity with id ${id}`,
            )
            continue
          }

          // parent가 있을 경우 parent entity에서 children으로 등록된 걸 삭제
          if (entity.parent != null) {
            const parentElement = entities.get(entity.parent)
            if (parentElement != null && parentElement.kind === 'group') {
              // parent entity의 children이 더 이상 없을 경우 삭제 대상에 포함
              if (parentElement.children.length < 1) {
                recursivelyFlagForDeletion([parentElement.id], true)
              }
            }
          }

          // children으로 등록된 entity들이 있다면 삭제 대상에 포함
          if (entity.kind === 'group' && !excludeChildren) {
            // children entity에서 parent entity의 children id 배열을 건드릴 경우 for ... of 배열 순환에 문제가 생김
            // index가 하나씩 앞으로 당겨지면서 일부 엔티티가 삭제 처리가 안됨
            // 따라서 배열을 복사해서 넘김
            recursivelyFlagForDeletion(entity.children.slice())
          }

          flaggedEntityIds.add(id)
        }
      }

      recursivelyFlagForDeletion(entityIds)

      const deletedEntities = [...flaggedEntityIds.values()].map(
        (entityId) => entities.get(entityId)!,
      )

      set((state) => {
        useEntityRefStore
          .getState()
          .deleteEntityRefs([...flaggedEntityIds.values()])

        for (const entityIdToDelete of flaggedEntityIds) {
          const entity = state.entities.get(entityIdToDelete)!
          if (entity.parent != null && !flaggedEntityIds.has(entity.parent)) {
            const parentGroup = state.entities.get(entity.parent)
            if (parentGroup?.kind === 'group') {
              const idx = parentGroup.children.findIndex(
                (id) => id === entityIdToDelete,
              )
              if (idx >= 0) {
                parentGroup.children.splice(idx, 1)
              }
            }
          }

          state.entities.delete(entityIdToDelete)
        }

        state.selectedEntityIds = state.selectedEntityIds.filter(
          (entityId) => !flaggedEntityIds.has(entityId),
        )
      })

      return deletedEntities
    },

    bulkImport: (entities) => {
      const { createEntityRefs } = useEntityRefStore.getState()

      createEntityRefs([...entities.keys()])
      set({ entities })
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

      deleteEntities(invalidEntityIds)
    },

    groupEntities: (entityIds, groupIdToSet) => {
      const groupId = groupIdToSet ?? nanoid(16)

      set((state) => {
        const entities = entityIds.map((id) => state.entities.get(id)!)

        const firstEntityParentId = entities[0].parent
        if (!entities.every((e) => e.parent === firstEntityParentId)) {
          logger.error('Cannot group entities with different parent')
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
      })

      return { groupId }
    },
    ungroupEntityGroup: (entityGroupId) =>
      set((state) => {
        const selectedEntityGroup = state.entities.get(entityGroupId)
        if (selectedEntityGroup?.kind !== 'group') {
          logger.error(
            `Selected entity ${entityGroupId} is not a group but ${selectedEntityGroup?.kind}`,
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
