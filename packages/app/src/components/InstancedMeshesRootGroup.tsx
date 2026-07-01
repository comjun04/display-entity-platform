import { type ThreeEvent, useFrame } from '@react-three/fiber'
import { type FC } from 'react'

import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
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
    // prevent passing event to entities behind other entities
    event.stopPropagation()

    const {
      headPainter: { enabled: headPainterEnabled },
      usingTransformControl,
    } = useEditorStore.getState()
    if (headPainterEnabled || usingTransformControl) return

    const latestBatchData = InstancedMeshManager.instance.getBatch(batchKey)
    if (latestBatchData == null) return

    const instance = [...latestBatchData.instances.values()].find(
      (d) => d.instanceIndex === event.instanceId,
    )
    if (instance == null) return

    const { entities, selectedEntityIds, setSelected } =
      useDisplayEntityStore.getState()
    // determine which entity should be selected on nested groups
    // if there's no parent entity or parent entity is already selected, select target entity
    // otherwise change the target entity to parent entity and recursively check again
    const f = (entityId: string) => {
      const entity = entities.get(entityId)
      if (entity == null) return

      // select this entity when there's no parent entity
      // or parent entity is already selected so it's time to select children
      if (entity.parent == null || selectedEntityIds.includes(entity.parent)) {
        return entityId
      }
      return f(entity.parent)
    }
    const entityIdToSelect = f(instance.entityId)
    if (entityIdToSelect == null) return

    setSelected([entityIdToSelect])
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
    <group name="InstancedMesh Root Group" matrixAutoUpdate={false}>
      {[...batches.values()].map((batchInfo) => (
        <InstancedMeshBatch key={batchInfo.key} batchInfo={batchInfo} />
      ))}
    </group>
  )
}
