import { type MutableRefObject, createRef } from 'react'
import { Group } from 'three'
import { create } from 'zustand'

import { getLogger } from '@/lib/logger'
import type { RefCallbackWithMutableRefObject } from '@/types/base'

const logger = getLogger('entityRefStore')

// ==========

type EntityRefStoreState = {
  entityRefs: Map<
    string,
    {
      id: string
      objectRef: MutableRefObject<Group>
    }
  >
  rootGroupRefData: {
    refAvailable: boolean
    objectRef: MutableRefObject<Group>
  }

  createEntityRefs: (entityIds: string[]) => void
  deleteEntityRefs: (entityIds: string[]) => void
  clearEntityRefs: () => void
}
// DisplayEntity#objectRef는 mutable해야 하므로(object 내부 property를 수정할 수 있어야 하므로)
// immer middleware로 전체 적용하지 않고 필요한 부분만 produce로 따로 적용
// DO NOT USE IMMER ON THIS STORE

export const useEntityRefStore = create<EntityRefStoreState>((set) => {
  const rootGroupRef = ((node: Group) => {
    rootGroupRef.current = node

    set((state) => ({
      rootGroupRefData: {
        ...state.rootGroupRefData,
        refAvailable: node != null,
      },
    }))
  }) as RefCallbackWithMutableRefObject<Group>

  return {
    entityRefs: new Map(),
    rootGroupRefData: {
      refAvailable: false,
      objectRef: rootGroupRef,
    },

    createEntityRefs: (entityIds) =>
      set((state) => {
        const newMap = new Map(state.entityRefs)
        for (const id of entityIds) {
          if (newMap.has(id)) {
            logger.warn(
              `entityRefStore.createEntityRefs(): creating entity ref data with entity id ${id} which already has one`,
            )
          }

          const ref = createRef<Group>() as unknown as MutableRefObject<Group>
          newMap.set(id, {
            id,
            objectRef: ref,
          })
        }
        return { entityRefs: newMap }
      }),
    deleteEntityRefs: (entityIds) =>
      set((state) => {
        const newMap = new Map(state.entityRefs)
        for (const id of entityIds) {
          newMap.delete(id)
        }
        return { entityRefs: newMap }
      }),
    // displayEntityStore.clearEntities() 호출 시(= 모든 엔티티 삭제 시)에만 호출할 것
    // 이외 호출 시 내부 엔티티 리스트와 맞지 않아 버그를 일으킬 수 있음
    clearEntityRefs: () =>
      set(() => ({
        entityRefs: new Map(),
      })),
  }
})
