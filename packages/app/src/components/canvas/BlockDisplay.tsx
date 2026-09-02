import { type ThreeEvent, extend } from '@react-three/fiber'
import { type FC, type MutableRefObject, memo, useMemo } from 'react'
import { Group } from 'three'
import { useShallow } from 'zustand/shallow'

import useBlockStates from '@/hooks/useBlockStates'
import { getMatchingBlockstateModel } from '@/lib/resources/blockstates'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import type { BlockstatesData } from '@/types/base'

import { BoundingBoxForInstanced } from './BoundingBox'
import { InstancedModel } from './instanced'
import { ZeroScaledGroup } from './zero-scaled-group'

extend({ ZeroScaledGroup })

const useMatchingBlockstatesModel = (data: {
  blockstatesData?: BlockstatesData
  blockstates: Record<string, string>
}) => {
  if (data.blockstatesData == null) return []

  return getMatchingBlockstateModel(data.blockstatesData, data.blockstates)
}

type BlockDisplayProps = {
  id: string
  type: string
  size: [number, number, number]
  position: [number, number, number]
  rotation: [number, number, number]
  color?: number | string
  onClick?: (event: ThreeEvent<MouseEvent>) => void
  objectRef?: MutableRefObject<Group>
}

const MemoizedInstancedModel = memo(InstancedModel)

const BlockDisplay: FC<BlockDisplayProps> = ({
  id,
  type,
  // size,
  // position,
  // rotation,
  onClick,
  objectRef: ref,
}) => {
  const { thisEntity, thisEntitySelected, thisEntityBlockstates } =
    useDisplayEntityStore(
      useShallow((state) => {
        const entity = state.entities.get(id)
        return {
          thisEntity: entity,
          thisEntitySelected: state.selectedEntityIds.includes(id),
          thisEntityBlockstates:
            entity?.kind === 'block' ? entity.blockstates : undefined,
        }
      }),
    )

  // =====

  const { data: blockstatesData } = useBlockStates(type)
  const matchingBlockstatesModels = useMatchingBlockstatesModel({
    blockstatesData,
    blockstates: thisEntity?.kind === 'block' ? thisEntity.blockstates : {},
  })

  const modelList = useMemo(() => {
    if (blockstatesData == null) return []

    const matchingBlockstateModels = getMatchingBlockstateModel(
      blockstatesData,
      thisEntityBlockstates ?? {},
    )
    return matchingBlockstateModels.map((modelData) => ({
      resourceLocation: modelData.model,
      xRotation: modelData.x,
      yRotation: modelData.y,
    }))
  }, [blockstatesData, thisEntityBlockstates])

  if (thisEntity?.kind !== 'block') return null

  return (
    <zeroScaledGroup
      ref={ref}
      name={`BlockDisplay ${id} ${type}`}
      matrixAutoUpdate={false}
    >
      <BoundingBoxForInstanced
        entityKind="block"
        modelList={modelList}
        visible={thisEntitySelected}
        color="gold"
      />

      <group onClick={onClick} matrixAutoUpdate={false}>
        {matchingBlockstatesModels.map((modelToApply, idx) => {
          const resourceLocation = modelToApply.model
          const modelId = `${id}|${resourceLocation}|x:${modelToApply.x}|y:${modelToApply.y}|${idx}`

          return (
            <MemoizedInstancedModel
              key={modelId}
              entityId={id}
              entityKind="block"
              modelId={modelId}
              resourceLocation={resourceLocation}
              xRotation={modelToApply.x}
              yRotation={modelToApply.y}
            />
          )
        })}
      </group>
    </zeroScaledGroup>
  )
}

export default BlockDisplay
