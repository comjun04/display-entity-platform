import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { getLogger } from '@/lib/logger'
import AutosaveService from '@/lib/services/autosave.service'
import type { History, Number3Tuple, PlayerHeadProperties } from '@/types/base'
import { isItemDisplayPlayerHead } from '@/types/guards'

import { useEditorStore } from './editorStore'

const logger = getLogger('historyStore')

interface HistoryStoreState {
  undoStack: History[]
  redoStack: History[]

  addHistory: (history: History) => void
  undoHistory: () => void
  redoHistory: () => void
  clearHistory: () => void

  playerHead: {
    textureDataListBeforePaint: Map<string, PlayerHeadProperties['texture']>
    storeTextureDataBeforePaint: (
      entityId: string,
      data: PlayerHeadProperties['texture'],
    ) => void
    flushToHistory: () => void
  }
}

export const useHistoryStore = create(
  immer<HistoryStoreState>((set, get) => ({
    // undo stack, pushed when user action, popped when undo
    undoStack: [],
    // redo stack, pushed when undo, popped when redo
    redoStack: [],

    addHistory: (history) => {
      set((state) => {
        logger.debug('addHistory():', history)
        state.undoStack.push(history)
        state.redoStack.length = 0
      })

      AutosaveService.instance.markOperationPerformed()
      useEditorStore.getState().setProjectDirty(true)
    },
    undoHistory: () => {
      import('./displayEntityStore')
        .then(({ useDisplayEntityStore }) => {
          set((state) => {
            // get the last non-proxied history
            const history = get().undoStack.slice(-1)[0]
            if (history == null) return

            logger.debug('undoHistory():', history)

            state.undoStack.pop()

            const {
              createNew,
              deleteEntities,
              groupEntities,
              ungroupEntityGroup,
            } = useDisplayEntityStore.getState()

            // TODO: apply beforeState
            switch (history.type) {
              case 'createEntities': {
                deleteEntities(
                  history.afterState.entities.map((entity) => entity.id),
                )
                break
              }
              case 'deleteEntities': {
                createNew(history.beforeState.entities, true)
                break
              }
              case 'group': {
                ungroupEntityGroup(history.parentGroupId, true)
                break
              }
              case 'ungroup': {
                groupEntities(
                  history.childrenEntityIds,
                  history.parentGroupId,
                  true,
                )
                break
              }
              case 'changeProperties': {
                applyHistoryPropertyChange(
                  history,
                  'undo',
                  useDisplayEntityStore,
                )
              }
            }

            // push non-proxied history to prevent errors
            // from proxy revocation
            state.redoStack.push(history)
          })

          AutosaveService.instance.markOperationPerformed()
          useEditorStore.getState().setProjectDirty(true)
        })
        .catch(console.error)
    },
    redoHistory: () => {
      import('./displayEntityStore')
        .then(({ useDisplayEntityStore }) => {
          set((state) => {
            // get the last non-proxied history
            const history = get().redoStack.slice(-1)[0]
            if (history == null) return

            logger.debug('redoHistory():', history)

            state.redoStack.pop()

            const {
              createNew,
              deleteEntities,
              groupEntities,
              ungroupEntityGroup,
            } = useDisplayEntityStore.getState()

            // TODO: apply afterState
            switch (history.type) {
              case 'createEntities': {
                createNew(history.afterState.entities, true)
                break
              }
              case 'deleteEntities': {
                deleteEntities(
                  history.beforeState.entities.map((entity) => entity.id),
                  true,
                )
                break
              }
              case 'group': {
                groupEntities(
                  history.childrenEntityIds,
                  history.parentGroupId,
                  true,
                )
                break
              }
              case 'ungroup': {
                ungroupEntityGroup(history.parentGroupId, true)
                break
              }
              case 'changeProperties': {
                applyHistoryPropertyChange(
                  history,
                  'redo',
                  useDisplayEntityStore,
                )
              }
            }
            // push non-proxied history to prevent errors
            // from proxy revocation
            state.undoStack.push(history)
          })

          AutosaveService.instance.markOperationPerformed()
          useEditorStore.getState().setProjectDirty(true)
        })
        .catch(console.error)
    },
    clearHistory: () =>
      set((state) => {
        state.undoStack.length = 0
        state.redoStack.length = 0
      }),

    playerHead: {
      textureDataListBeforePaint: new Map(),
      storeTextureDataBeforePaint: (entityId, data) =>
        set((state) => {
          if (state.playerHead.textureDataListBeforePaint.has(entityId)) {
            // data already exist, ignoring
            return
          }

          logger.debug(
            `playerHead.storeTextureDataBeforePaint(): storing player head data of entity ${entityId}`,
          )
          state.playerHead.textureDataListBeforePaint.set(entityId, data)
        }),
      flushToHistory: () =>
        import('./displayEntityStore')
          .then(({ useDisplayEntityStore }) => {
            const { entities } = useDisplayEntityStore.getState()
            const { textureDataListBeforePaint } = get().playerHead

            const historyEntitiesData = [
              ...textureDataListBeforePaint.entries(),
            ]
              .map(([entityId, data]) => {
                const entity = entities.get(entityId)!
                if (!isItemDisplayPlayerHead(entity)) {
                  // this should not happen
                  logger.error(
                    `playerHead.flushToHistory(): entity ${entityId} is not an item display player_head but ${entity.kind}. This should happen, ignoring.`,
                  )
                  return null
                }

                return {
                  id: entityId,
                  beforeState: {
                    kind: 'item' as const,
                    playerHeadProperties: {
                      texture: data,
                    },
                  },
                  afterState: {
                    kind: 'item' as const,
                    playerHeadProperties: entity.playerHeadProperties,
                  },
                }
              })
              .filter((d) => d != null)

            set((state) => {
              state.undoStack.push({
                type: 'changeProperties',
                entities: historyEntitiesData,
              })
              state.redoStack.length = 0

              state.playerHead.textureDataListBeforePaint.clear()
            })

            AutosaveService.instance.markOperationPerformed()
            useEditorStore.getState().setProjectDirty(true)
          })
          .catch(console.error),
    },
  })),
)

function applyHistoryPropertyChange(
  history: History,
  type: 'undo' | 'redo',
  displayEntityStore: (typeof import('./displayEntityStore'))['useDisplayEntityStore'],
) {
  if (history.type !== 'changeProperties') {
    logger.warn(
      `applyHistoryPropertyChange(): Expected history type 'changeProperties' but got ${history.type}. Skipping.`,
    )
    return
  }

  const {
    batchSetEntityTransformation,
    setEntityDisplayType,
    setBDEntityBlockstates,
    setTextDisplayProperties,
    setItemDisplayPlayerHeadProperties,
  } = displayEntityStore.getState()

  const transformationChanges = new Map<
    string,
    { id: string } & Partial<{
      translation: Number3Tuple
      rotation: Number3Tuple
      scale: Number3Tuple
    }>
  >()

  for (const record of history.entities) {
    // check for transformation change
    const transformationChange: Partial<{
      translation: Number3Tuple
      rotation: Number3Tuple
      scale: Number3Tuple
    }> = {}

    const stateToUse = type === 'redo' ? record.afterState : record.beforeState

    if ('position' in stateToUse) {
      transformationChange.translation = stateToUse.position
    }
    if ('rotation' in stateToUse) {
      transformationChange.rotation = stateToUse.rotation
    }
    if ('size' in stateToUse) {
      transformationChange.scale = stateToUse.size
    }

    if (Object.keys(transformationChange).length > 0) {
      transformationChanges.set(record.id, {
        id: record.id,
        ...transformationChange,
      })
    }

    if (stateToUse.kind === 'item') {
      // apply item_display display property
      if (stateToUse.display !== undefined) {
        setEntityDisplayType(record.id, stateToUse.display, true)
      }

      // apply item_display player_head properties
      if (stateToUse.playerHeadProperties != null) {
        setItemDisplayPlayerHeadProperties(
          record.id,
          stateToUse.playerHeadProperties,
          true,
        )
      }
    }

    // apply block_display blockstates
    if (stateToUse.kind === 'block' && stateToUse.blockstates != null) {
      setBDEntityBlockstates(record.id, stateToUse.blockstates, true)
    }

    // apply text_display properties
    if (stateToUse.kind === 'text') {
      const { kind: _, ...rest } = stateToUse
      setTextDisplayProperties(record.id, rest, true)
    }
  }

  // apply transformation change
  if (transformationChanges.size > 0) {
    batchSetEntityTransformation([...transformationChanges.values()], true)

    const { entities, selectedEntityIds } = displayEntityStore.getState()
    if (selectedEntityIds.length > 0) {
      const firstSelectedEntity = entities.get(selectedEntityIds[0])
      if (firstSelectedEntity != null) {
        useEditorStore.getState().setSelectionBaseTransformation({
          position: firstSelectedEntity.position,
          rotation: firstSelectedEntity.rotation,
          size: firstSelectedEntity.size,
        })
      }
    }
  }
}
