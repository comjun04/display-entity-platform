import { invalidate, useFrame } from '@react-three/fiber'
import { type FC, useEffect, useRef } from 'react'
import { Group, Matrix4 } from 'three'

import { useInstancedMeshStore } from '@/stores/instancedMeshStore'

interface InstacedModelProps {
  entityId: string
  modelId: string
  resourceLocation: string
}
export const InstancedModel: FC<InstacedModelProps> = ({
  entityId,
  modelId,
  resourceLocation,
}) => {
  const objectRef = useRef<Group>(null)
  const matrixRef = useRef(new Matrix4().fromArray(Array(16).fill(0)))

  const batchStatus = useInstancedMeshStore((state) => {
    const batch = state.batches.get(resourceLocation)
    if (batch == null) return

    return batch.status
  })

  useEffect(() => {
    invalidate()
  }, [batchStatus])

  useEffect(() => {
    if (batchStatus === 'loading') return

    useInstancedMeshStore
      .getState()
      .allocateInstance(resourceLocation, modelId, entityId)
    invalidate()

    return () => {
      useInstancedMeshStore.getState().freeInstance(resourceLocation, modelId)
    }
  }, [resourceLocation, modelId, entityId, batchStatus])

  useFrame(() => {
    // if batch is not ready, retry on next frame
    if (batchStatus !== 'ready' || objectRef.current == null) {
      invalidate()
      return
    }

    const { setMatrix } = useInstancedMeshStore.getState()

    // if object world matrix changed, set matrix of batch instance
    if (!objectRef.current.matrixWorld.equals(matrixRef.current)) {
      const success = setMatrix(
        resourceLocation,
        modelId,
        objectRef.current.matrixWorld,
      )
      if (success) {
        matrixRef.current.copy(objectRef.current.matrixWorld)
      } else {
        // retry on next frame if failed to set matrix
        invalidate()
      }
    }
  })

  return <group ref={objectRef} matrixWorldAutoUpdate />
}
