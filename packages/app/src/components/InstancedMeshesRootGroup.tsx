import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { type FC } from 'react'

import { getLogger } from '@/lib/logger'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import {
  type InstancedMeshBatchData,
  useInstancedMeshStore,
} from '@/stores/instancedMeshStore'

const logger = getLogger('InstancedMeshesRootGroup')

interface InstancedMeshBatchProps {
  batch: InstancedMeshBatchData
}
const InstancedMeshBatch: FC<InstancedMeshBatchProps> = ({ batch }) => {
  const handleClick = (event: ThreeEvent<MouseEvent>, batchKey: string) => {
    // event.stopPropagation()
    console.log(event)

    const latestBatchData = useInstancedMeshStore
      .getState()
      .batches.get(batchKey)
    if (latestBatchData == null) return

    const instance = [...latestBatchData.instances.values()].find(
      (d) => d.instanceIndex === event.instanceId,
    )
    if (instance == null) return

    useDisplayEntityStore.getState().setSelected([instance.entityId])
  }

  useFrame(() => {
    const { _rebuildBatch, _computeBoundsForBatch } =
      useInstancedMeshStore.getState()
    if (batch.shouldRebuild) {
      logger.debug(`Rebuilding batch ${batch.key}`)
      _rebuildBatch(batch.key)
    }

    const { usingTransformControl } = useEditorStore.getState()
    if (batch.shouldComputeBounds && !usingTransformControl) {
      _computeBoundsForBatch(batch.key)
    }
  })

  return batch.status === 'ready' ? (
    <primitive
      key={batch.key}
      object={batch.mesh}
      onClick={(evt: ThreeEvent<MouseEvent>) => handleClick(evt, batch.key)}
    />
  ) : null
}

export const InstancedMeshesRootGroup: FC = () => {
  const batches = useInstancedMeshStore((state) => state.batches)
  return (
    <>
      <group name="InstancedMesh Root Group">
        {[...batches.values()].map((batch) => (
          <InstancedMeshBatch key={batch.key} batch={batch} />
        ))}
      </group>
    </>
  )
}
