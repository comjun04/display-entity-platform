import {
  type BufferGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  type Material,
  Matrix4,
} from 'three'
import { create } from 'zustand'

import { loadModel } from '@/lib/resources/model'
import { generateModelMeshIngredients } from '@/lib/resources/modelMesh'
import { stripMinecraftPrefix } from '@/lib/utils'

const DEFAULT_CAPACITY = 16
const ZeroScaleMatrix4 = new Matrix4().makeScale(0, 0, 0)
const ZeroScaleMatrix4Arr = ZeroScaleMatrix4.toArray()

export type InstancedMeshBatchData = {
  status: 'loading' | 'ready'
  key: string

  capacity: number
  usedCount: number
  freeSlots: number[]

  shouldComputeBounds: boolean
  shouldRebuild: boolean

  instances: Map<
    string,
    {
      instanceIndex: number
      entityId: string
    }
  > // model id -> instance data
} & (
  | {
      status: 'loading'
      mesh: InstancedMesh // dummy mesh
      geometry: undefined
      materials: undefined
    }
  | {
      status: 'ready'
      mesh: InstancedMesh
      geometry: BufferGeometry
      materials: Material[]
    }
)
export interface InstancedMeshStoreState {
  batches: Map<string, InstancedMeshBatchData>

  allocateInstance: (
    resourceLocation: string,
    modelId: string,
    entityId: string,
  ) => void
  freeInstance: (resourceLocation: string, modelId: string) => void

  setMatrix: (key: string, modelId: string, matrix: Matrix4) => boolean

  _computeBoundsForBatch: (key: string) => void
  _rebuildBatch: (resourceLocation: string) => void
}
export const useInstancedMeshStore = create<InstancedMeshStoreState>(
  (set, get) => ({
    batches: new Map(),

    allocateInstance: (resourceLocation, modelId, entityId) => {
      const { batches } = get()

      const batch = batches.get(resourceLocation)
      if (batch == null) {
        set((state) => {
          const batchesDraft = new Map(state.batches)
          /* eslint-disable @typescript-eslint/no-explicit-any */
          const dummyMesh = new InstancedMesh(
            null as any,
            null as any,
            DEFAULT_CAPACITY,
          )
          /* eslint-enable @typescript-eslint/no-explicit-any */
          dummyMesh.instanceMatrix.setUsage(DynamicDrawUsage)
          dummyMesh.instanceMatrix.copyArray(
            getFlattenedZeroScaleMatrixElements(DEFAULT_CAPACITY),
          )
          dummyMesh.instanceMatrix.needsUpdate = true

          const newBatch: InstancedMeshBatchData = {
            key: resourceLocation,
            status: 'loading', // indicate as loading

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            mesh: dummyMesh,
            geometry: undefined,
            materials: undefined,

            capacity: DEFAULT_CAPACITY,
            usedCount: 0,
            freeSlots: [],

            shouldComputeBounds: false,
            shouldRebuild: false,

            instances: new Map(),
          }
          batchesDraft.set(resourceLocation, newBatch)

          return { batches: batchesDraft }
        })

        // TODO: switch from async function to plain sync function with .then() chain on promises
        prepareMeshIngredients(resourceLocation)
          .then((meshIngredients) => {
            set((state) => {
              const batchesDraft = new Map(state.batches)
              const oldBatch = batchesDraft.get(resourceLocation)!

              const newMesh = new InstancedMesh(
                meshIngredients.geometry,
                meshIngredients.materials,
                oldBatch.capacity,
              )
              newMesh.instanceMatrix.setUsage(DynamicDrawUsage)
              newMesh.instanceMatrix.copyArray(
                oldBatch.mesh.instanceMatrix.array,
              )
              newMesh.instanceMatrix.needsUpdate = true

              oldBatch.mesh.dispose()

              const newBatch: InstancedMeshBatchData = {
                ...oldBatch,
                status: 'ready',

                mesh: newMesh,
                geometry: meshIngredients.geometry,
                materials: meshIngredients.materials,

                // shouldRebuild: false, // we already rebuilt instancedmesh
              }
              batchesDraft.set(resourceLocation, newBatch)
              return { batches: batchesDraft }
            })
          })
          .catch(console.error)
      }

      set((state) => {
        const batchesDraft = new Map(state.batches)
        const oldBatch = batchesDraft.get(resourceLocation)!
        const newBatch: InstancedMeshBatchData = {
          ...oldBatch,
        }

        // allocate new space
        let index: number
        if (oldBatch.freeSlots.length > 0) {
          index = oldBatch.freeSlots[0] // FIFO
          newBatch.freeSlots = oldBatch.freeSlots.slice(1)
        } else {
          if (oldBatch.usedCount + 1 >= oldBatch.capacity) {
            // TODO: grow now
            const newMesh = new InstancedMesh(
              oldBatch.geometry,
              oldBatch.materials,
              oldBatch.capacity * 2,
            )
            newMesh.instanceMatrix.setUsage(DynamicDrawUsage)
            newMesh.instanceMatrix.copyArray(oldBatch.mesh.instanceMatrix.array)
            newMesh.instanceMatrix.set(
              getFlattenedZeroScaleMatrixElements(oldBatch.capacity),
              oldBatch.capacity * 16,
            )
            newMesh.instanceMatrix.needsUpdate = true

            newBatch.mesh = newMesh
            newBatch.capacity = oldBatch.capacity * 2

            oldBatch.mesh.dispose()
          }
          index = oldBatch.usedCount + 1
          newBatch.usedCount = oldBatch.usedCount + 1
        }

        // TODO: finish this

        newBatch.instances.set(modelId, {
          instanceIndex: index,
          entityId,
        })

        batchesDraft.set(newBatch.key, newBatch)

        return { batches: batchesDraft }
      })
    },
    freeInstance: (resourceLocation, modelId) => {
      const { batches } = get()
      const batch = batches.get(resourceLocation)
      if (batch == null) return

      const batchesDraft = new Map(batches)

      const existing = batch.instances.get(modelId)
      if (existing != null) {
        batch.instances.delete(modelId)
        batch.freeSlots.push(existing.instanceIndex)

        // hide instance
        if (batch.status === 'ready') {
          batch.mesh.setMatrixAt(existing.instanceIndex, ZeroScaleMatrix4)
          batch.mesh.instanceMatrix.needsUpdate = true
        }
      }

      set({ batches: batchesDraft })
    },

    setMatrix: (key, modelId, matrix) => {
      let success = false
      set((state) => {
        const batchesDraft = new Map(state.batches)
        const oldBatch = batchesDraft.get(key)
        if (oldBatch == null) {
          errorLog(`Cannot set matrix of unknown batch: ${key}`)
          return {}
        }

        const instance = oldBatch.instances.get(modelId)
        if (instance == null) {
          errorLog(
            `Cannot set matrix to unknown instance ${modelId} of batch ${key}`,
          )
          return {}
        }

        const { instanceIndex } = instance

        if (
          oldBatch.mesh.count <= instanceIndex ||
          oldBatch.freeSlots.includes(instanceIndex)
        ) {
          errorLog(
            `Cannot set matrix to unallocated/unused instance ${instanceIndex} at batch ${key} (total capacity: ${oldBatch.mesh.count})`,
          )
          return {}
        }

        // ===

        const newBatch: InstancedMeshBatchData = { ...oldBatch }

        newBatch.mesh.setMatrixAt(instanceIndex, matrix)
        newBatch.mesh.instanceMatrix.needsUpdate = true

        newBatch.shouldComputeBounds = true

        batchesDraft.set(newBatch.key, newBatch)
        success = true
        return { batches: batchesDraft }
      })

      return success
    },

    _computeBoundsForBatch: (key) => {
      const { batches } = get()
      const batch = batches.get(key)
      if (batch == null) {
        errorLog(`Cannot compute bounds of unknown batch: ${key}`)
        return
      } else if (batch.status === 'loading') {
        errorLog(`Cannot compute bounds of batch ${key} which is still loading`)
        return
      }

      if (!batch.shouldComputeBounds) return

      const batchesDraft = new Map(batches)

      // We should run this to be able to get bounding box (borders)
      // and sphere (for raycasting for click detection) to work
      // But computing bounding box / sphere can be expensive when called per instance
      // so process at batch level at once
      batch.mesh.computeBoundingBox()
      // need to compute bounding sphere manually to get raycasting work
      // (r3f elements do this automatically)
      batch.mesh.computeBoundingSphere()
      batch.shouldComputeBounds = false

      set({ batches: batchesDraft })
    },

    _rebuildBatch: (resourceLocation) => {
      set((state) => {
        const oldBatch = state.batches.get(resourceLocation)
        if (oldBatch == null || oldBatch.status === 'loading') {
          return {}
        }

        const batchesDraft = new Map(state.batches)

        // create new InstancedMesh with updated capacity
        const newMesh = new InstancedMesh(
          oldBatch.geometry,
          oldBatch.materials,
          oldBatch.capacity,
        )
        newMesh.instanceMatrix.setUsage(DynamicDrawUsage)
        newMesh.instanceMatrix.copyArray(oldBatch.mesh.instanceMatrix.array)
        newMesh.instanceMatrix.set(
          getFlattenedZeroScaleMatrixElements(
            newMesh.count - oldBatch.mesh.count,
          ),
          oldBatch.mesh.count * 16,
        ) // hide newly created instance slots by default
        newMesh.instanceMatrix.needsUpdate = true

        oldBatch.mesh.dispose()

        oldBatch.mesh = newMesh
        oldBatch.shouldRebuild = false

        return { batches: batchesDraft }
      })
    },
  }),
)

function errorLog(...content: unknown[]) {
  // Some errors from `setMatrix()` can be shown when this store is reloaded via HMR while developing.
  // The reason is `setMatrix()` is usually called every frame to synchronize between dummy group and instance matrix.
  //
  // It may be fine in this case.
  // If rendered output seems wrong then change below valut and test
  // (reloading this file when project is loaded always makes error, so do full-refresh and test)
  const shouldLog = false

  // =====
  // always log on production (production has no HMR)
  if (!__IS_DEV__ || shouldLog) {
    console.error(...content)
  }
}

/**
 * Gets flattened matrix elements with all matrixes are correctly zero-scaled.
 * @param matrixCount count of matrixes to include
 * @returns array of flattened zero-scaled matrix elements
 */
function getFlattenedZeroScaleMatrixElements(matrixCount: number) {
  return Array<typeof ZeroScaleMatrix4Arr>(matrixCount)
    .fill(ZeroScaleMatrix4Arr)
    .flat()
}

async function prepareMeshIngredients(resourceLocation: string) {
  const { data: modelData, isBlockShapedItemModel } =
    await loadModel(resourceLocation)
  const isItemModel = stripMinecraftPrefix(resourceLocation).startsWith('item/')

  const meshIngredients = await generateModelMeshIngredients({
    modelResourceLocation: resourceLocation,
    elements: modelData.elements,
    textures: modelData.textures,
    isItemModel,
    isBlockShapedItemModel,
    playerHeadData: undefined,
  })
  if (meshIngredients == null) {
    throw new Error(`Failed to load model mesh data for ${resourceLocation}`)
  }

  return meshIngredients
}
