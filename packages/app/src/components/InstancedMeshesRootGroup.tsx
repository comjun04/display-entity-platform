import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { type FC } from 'react'

import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import {
  InstancedMeshManager,
  type MinimalInstancedMeshBatchData,
  useInstancedMeshStore,
} from '@/stores/instancedMeshStore'

interface InstancedMeshBatchProps {
  batchInfo: MinimalInstancedMeshBatchData
}
const InstancedMeshBatch: FC<InstancedMeshBatchProps> = ({ batchInfo }) => {
  const handleClick = (event: ThreeEvent<MouseEvent>, batchKey: string) => {
    // event.stopPropagation()
    console.log(event)

    const latestBatchData = InstancedMeshManager.instance.getBatch(batchKey)
    if (latestBatchData == null) return

    const instance = [...latestBatchData.instances.values()].find(
      (d) => d.instanceIndex === event.instanceId,
    )
    if (instance == null) return

    useDisplayEntityStore.getState().setSelected([instance.entityId])
  }

  useFrame(() => {
    const instancedMeshManager = InstancedMeshManager.instance
    instancedMeshManager.updateDirty()
  })

  return batchInfo.status === 'ready' ? (
    <primitive
      key={batchInfo.key}
      object={batchInfo.mesh}
      onClick={(evt: ThreeEvent<MouseEvent>) => handleClick(evt, batchInfo.key)}
    />
  ) : null
}

export const InstancedMeshesRootGroup: FC = () => {
  const batches = useInstancedMeshStore((state) => state.batches)
  return (
    <>
      <group name="InstancedMesh Root Group">
        {[...batches.values()].map((batchInfo) => (
          <InstancedMeshBatch key={batchInfo.key} batchInfo={batchInfo} />
        ))}
      </group>
    </>
  )
}
