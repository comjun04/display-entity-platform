import type { ThreeEvent } from '@react-three/fiber'
import { type FC, type MutableRefObject, memo } from 'react'
import { Group } from 'three'
import { useShallow } from 'zustand/shallow'

import useBlockStates from '@/hooks/useBlockStates'
import { getMatchingBlockstateModel } from '@/lib/resources/blockstates'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import type { BlockstatesData } from '@/types/base'

import { BoundingBoxForInstanced } from './BoundingBox'
import Model from './Model'
import { InstancedModel } from './instanced'

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

const MemoizedModel = memo(Model)
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
  const { thisEntity, thisEntitySelected } = useDisplayEntityStore(
    useShallow((state) => ({
      thisEntity: state.entities.get(id),
      thisEntitySelected: state.selectedEntityIds.includes(id),
    })),
  )

  // =====

  const { data: blockstatesData } = useBlockStates(type)
  const matchingBlockstatesModel = useMatchingBlockstatesModel({
    blockstatesData,
    blockstates: thisEntity?.kind === 'block' ? thisEntity.blockstates : {},
  })

  if (thisEntity?.kind !== 'block') return null

  return (
    <group ref={ref}>
      <BoundingBoxForInstanced
        modelResourceLocations={matchingBlockstatesModel.map((d) => d.model)}
        visible={thisEntitySelected}
        color="gold"
      />

      <group name="base2" onClick={onClick}>
        {matchingBlockstatesModel.map((modelToApply, idx) => {
          const resourceLocation = modelToApply.model
          return (
            <>
              {/* <MemoizedModel
                key={idx}
                initialResourceLocation={modelToApply.model}
                xRotation={modelToApply.x}
                yRotation={modelToApply.y}
              /> */}

              <MemoizedInstancedModel
                key={idx}
                entityId={id}
                modelId={`${id};${resourceLocation};${idx}`}
                resourceLocation={resourceLocation}
                xRotation={modelToApply.x}
                yRotation={modelToApply.y}
              />
            </>
          )
        })}
      </group>
    </group>
  )
}

export default BlockDisplay
