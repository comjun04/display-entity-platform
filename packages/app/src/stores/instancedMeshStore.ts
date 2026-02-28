import { invalidate } from '@react-three/fiber'
import {
  type BufferGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  type Material,
  Matrix4,
  Quaternion,
} from 'three'
import { MathUtils } from 'three'
import { Euler } from 'three'
import { create } from 'zustand'

import { getLogger } from '@/lib/logger'
import { loadModel } from '@/lib/resources/model'
import { generateModelMeshIngredients } from '@/lib/resources/modelMesh'
import { stripMinecraftPrefix } from '@/lib/utils'

import { useEditorStore } from './editorStore'
import { useEntityRefStore } from './entityRefStore'

const DEFAULT_CAPACITY = 16
const ZeroScaleMatrix4 = new Matrix4().makeScale(0, 0, 0)
const ZeroScaleMatrix4Arr = ZeroScaleMatrix4.toArray()
const HalfBlockTranslatedMatrix = new Matrix4().makeTranslation(0.5, 0.5, 0.5)
const ReverseHalfBlockTranslatedMatrix = new Matrix4().makeTranslation(
  -0.5,
  -0.5,
  -0.5,
)

export class InstancedMeshManager {
  // singleton class setup
  private static _instance?: InstancedMeshManager
  static get instance() {
    if (this._instance == null) {
      this._instance = new this()
    }

    return this._instance
  }

  private constructor() {}

  private logger = getLogger('InstancedMeshManager')

  private batches = new Map<string, InstancedMeshBatchData>()
  private entityToModels = new Map<string, Set<string>>()
  private modelToBatch = new Map<string, string>()

  private dirtyEntities = new Set<string>()

  getBatch(key: string) {
    return this.batches.get(key)
  }

  allocateInstance(
    resourceLocation: string,
    data: {
      modelId: string
      entityId: string
      rotation: [number, number]
    },
  ) {
    // this.logger.debug('allocateInstance()', resourceLocation, data)

    if (!this.batches.has(resourceLocation)) {
      // Initialize dummy mesh and register it first
      this.logger.debug(`Initializing dummy mesh for model ${resourceLocation}`)

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
      this.batches.set(resourceLocation, newBatch)

      useInstancedMeshStore.getState()._addBatch(resourceLocation, {
        status: 'loading',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        mesh: dummyMesh,
      })

      // then start loading mesh ingredients
      // and replace dummy mesh with new one when ready
      prepareMeshIngredients(resourceLocation)
        .then((meshIngredients) => {
          const batch = this.batches.get(resourceLocation)!

          const newMesh = new InstancedMesh(
            meshIngredients.geometry,
            meshIngredients.materials,
            batch.capacity,
          )
          newMesh.instanceMatrix.setUsage(DynamicDrawUsage)
          newMesh.instanceMatrix.copyArray(batch.mesh.instanceMatrix.array)
          newMesh.instanceMatrix.needsUpdate = true

          batch.mesh.dispose()

          batch.mesh = newMesh
          batch.geometry = meshIngredients.geometry
          batch.materials = meshIngredients.materials

          batch.status = 'ready'

          useInstancedMeshStore.getState()._updateBatchInfo(resourceLocation, {
            status: 'ready',
            mesh: newMesh,
          })
        })
        .catch(console.error)
    }

    const batch = this.batches.get(resourceLocation)!

    // allocate new space
    let index = 0
    if (batch.freeSlots.length > 0) {
      index = batch.freeSlots.shift()! // FIFO
    } else {
      if (batch.usedCount + 1 >= batch.capacity) {
        // TODO: grow now
        const newMesh = new InstancedMesh(
          batch.geometry,
          batch.materials,
          batch.capacity * 2,
        )
        newMesh.instanceMatrix.setUsage(DynamicDrawUsage)
        newMesh.instanceMatrix.copyArray(batch.mesh.instanceMatrix.array)
        newMesh.instanceMatrix.set(
          getFlattenedZeroScaleMatrixElements(batch.capacity),
          batch.capacity * 16,
        )
        newMesh.instanceMatrix.needsUpdate = true

        batch.mesh = newMesh
        batch.capacity *= 2

        batch.mesh.dispose()

        useInstancedMeshStore.getState()._updateBatchInfo(resourceLocation, {
          mesh: newMesh,
        })
      }
      index = batch.usedCount
      batch.usedCount++
    }

    batch.instances.set(data.modelId, {
      instanceIndex: index,
      entityId: data.entityId,
      rotation: data.rotation,
    })

    if (!this.entityToModels.has(data.entityId)) {
      this.entityToModels.set(data.entityId, new Set())
    }
    const s = this.entityToModels.get(data.entityId)!
    s.add(data.modelId)

    this.modelToBatch.set(data.modelId, resourceLocation)

    this.markEntityDirty(data.entityId)
  }

  freeInstance(resourceLocation: string, modelId: string) {
    // this.logger.debug('freeInstance', resourceLocation, modelId)

    const batch = this.batches.get(resourceLocation)
    if (batch == null) return

    const existingInstance = batch.instances.get(modelId)
    if (existingInstance != null) {
      batch.instances.delete(modelId)
      batch.freeSlots.push(existingInstance.instanceIndex)

      // hide instance
      if (batch.status === 'ready') {
        batch.mesh.setMatrixAt(existingInstance.instanceIndex, ZeroScaleMatrix4)
        batch.mesh.instanceMatrix.needsUpdate = true
      }
    }
  }

  markEntityDirty(entityId: string) {
    this.dirtyEntities.add(entityId)

    invalidate()
  }

  updateDirty() {
    const { entityRefs } = useEntityRefStore.getState()

    const touchedBatches = new Set<InstancedMeshBatchData>()
    const tempMatrix4 = new Matrix4()

    for (const entityId of this.dirtyEntities) {
      const entityRefData = entityRefs.get(entityId)
      if (entityRefData == null) {
        continue
      }
      const matrix = entityRefData.objectRef.current.matrixWorld.clone()

      const modelKeys = this.entityToModels.get(entityId)
      if (modelKeys == null) {
        continue
      }

      for (const modelKey of modelKeys) {
        const batchKey = this.modelToBatch.get(modelKey)
        if (batchKey == null) {
          continue
        }

        const batch = this.batches.get(batchKey)
        if (batch == null || batch.status === 'loading') {
          continue
        }

        const instance = batch.instances.get(modelKey)
        if (instance == null) {
          continue
        }

        // apply rotations
        const rotatedMatrix = tempMatrix4
          .identity()
          .premultiply(ReverseHalfBlockTranslatedMatrix)
          .premultiply(
            // set x rotation
            new Matrix4().makeRotationFromQuaternion(
              new Quaternion().setFromEuler(
                new Euler(MathUtils.degToRad(-instance.rotation[0]), 0, 0),
              ),
            ),
          )
          .premultiply(
            // set y rotation
            new Matrix4().makeRotationFromQuaternion(
              new Quaternion().setFromEuler(
                new Euler(0, MathUtils.degToRad(-instance.rotation[1]), 0),
              ),
            ),
          )
          .premultiply(HalfBlockTranslatedMatrix)
        matrix.multiply(rotatedMatrix)

        batch.mesh.setMatrixAt(instance.instanceIndex, matrix)

        touchedBatches.add(batch)
      }
    }

    const { usingTransformControl } = useEditorStore.getState()
    for (const batch of touchedBatches) {
      batch.mesh.instanceMatrix.needsUpdate = true
      // skip expensive bounding box/sphere computing when selected entities are moving
      if (!usingTransformControl) {
        batch.mesh.computeBoundingBox()
        batch.mesh.computeBoundingSphere()
      }
    }
    if (touchedBatches.size > 0) {
      invalidate()
    }

    this.dirtyEntities.clear()
  }

  setRotation(modelId: string, newRotation: { x?: number; y?: number }) {
    const batchId = this.modelToBatch.get(modelId)
    if (batchId == null) return
    const batch = this.batches.get(batchId)
    if (batch == null) return

    const instance = batch.instances.get(modelId)
    if (instance == null) return

    instance.rotation = [
      newRotation.x ?? instance.rotation[0],
      newRotation.y ?? instance.rotation[1],
    ]

    this.markEntityDirty(instance.entityId)
  }
}

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
      rotation: [number, number]
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
export type MinimalInstancedMeshBatchData = Pick<
  InstancedMeshBatchData,
  'key' | 'status' | 'mesh'
>
export interface InstancedMeshStoreState {
  batches: Map<string, MinimalInstancedMeshBatchData>

  _addBatch: (
    key: string,
    data: Omit<MinimalInstancedMeshBatchData, 'key'>,
  ) => void
  _updateBatchInfo: (
    key: string,
    data: Partial<Omit<MinimalInstancedMeshBatchData, 'key'>>,
  ) => void
}
export const useInstancedMeshStore = create<InstancedMeshStoreState>((set) => ({
  batches: new Map(),

  _addBatch: (key, data) =>
    set((state) => {
      const batchesDraft = new Map(state.batches)
      batchesDraft.set(key, { key, ...data })
      return { batches: batchesDraft }
    }),
  _updateBatchInfo: (key, data) =>
    set((state) => {
      const batchesDraft = new Map(state.batches)
      const batch = batchesDraft.get(key)
      if (batch == null) {
        return {}
      }

      Object.assign(batch, data)
      return { batches: batchesDraft }
    }),
}))

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
