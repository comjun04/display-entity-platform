import type { ModelDisplayPositionKey } from '@depl/shared'
import { invalidate, useFrame } from '@react-three/fiber'
import { type FC, useEffect, useRef } from 'react'
import { Group, Matrix4 } from 'three'

import {
  InstancedMeshManager,
  makeBatchKey,
  useInstancedMeshStore,
} from '@/stores/instancedMeshStore'

interface InstacedModelProps {
  entityId: string
  entityKind: 'block' | 'item'
  modelId: string
  resourceLocation: string
  displayType?: ModelDisplayPositionKey
  xRotation?: number
  yRotation?: number
}
export const InstancedModel: FC<InstacedModelProps> = ({
  entityId,
  entityKind,
  modelId,
  resourceLocation,
  displayType,
  xRotation = 0,
  yRotation = 0,
}) => {
  const objectRef = useRef<Group>(null)
  const matrixRef = useRef(new Matrix4().fromArray(Array(16).fill(0)))
  const allocatedBatchKeyRef = useRef<string | null>(null)

  const batchKey = makeBatchKey(resourceLocation, entityKind)

  const batchStatus = useInstancedMeshStore((state) => {
    const batch = state.batches.get(batchKey)
    if (batch == null) return

    return batch.status
  })

  useEffect(() => {
    invalidate()
  }, [batchStatus])

  // allocate instance
  useEffect(() => {
    if (batchStatus === 'loading') return
    if (allocatedBatchKeyRef.current != null) return // skip when already allocated

    // fetch latest batch status from manager directly
    // (to prevent race-condition between manager and store update gap)
    const batch = InstancedMeshManager.instance.getBatch(batchKey)
    if (batch?.status === 'loading') return

    allocatedBatchKeyRef.current =
      InstancedMeshManager.instance.allocateInstance(resourceLocation, {
        modelId,
        entityId,
        entityKind,
        rotation: [xRotation, yRotation],
      })
    invalidate()
  }, [
    batchKey,
    resourceLocation,
    modelId,
    entityId,
    entityKind,
    batchStatus,
    xRotation,
    yRotation,
  ])

  // free instance when important data changed which requires reallocation
  useEffect(() => {
    return () => {
      // skip when instance is not allocated
      if (allocatedBatchKeyRef.current == null) return

      InstancedMeshManager.instance.freeInstance(
        allocatedBatchKeyRef.current,
        modelId,
      )
      allocatedBatchKeyRef.current = null
    }
  }, [batchKey, modelId])

  useEffect(() => {
    if (allocatedBatchKeyRef.current == null) return

    InstancedMeshManager.instance.setRotation(modelId, {
      x: xRotation,
      y: yRotation,
    })
  }, [modelId, xRotation, yRotation])
  useEffect(() => {
    if (allocatedBatchKeyRef.current == null) return

    InstancedMeshManager.instance.setDisplay(modelId, displayType)
  }, [modelId, displayType])

  useFrame(() => {
    // if batch is not ready, retry on next frame
    if (batchStatus !== 'ready' || objectRef.current == null) {
      invalidate()
      return
    }

    // if object world matrix changed, set matrix of batch instance
    if (!objectRef.current.matrixWorld.equals(matrixRef.current)) {
      InstancedMeshManager.instance.markEntityDirty(entityId)
      matrixRef.current.copy(objectRef.current.matrixWorld)
      invalidate()
    }
  })

  return <group ref={objectRef} matrixAutoUpdate={false} />
}
