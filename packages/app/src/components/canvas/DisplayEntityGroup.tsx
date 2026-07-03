import type { Number3Tuple } from '@depl/shared'
import { type ThreeEvent, invalidate, useFrame } from '@react-three/fiber'
import { type FC, type MutableRefObject, useEffect, useRef } from 'react'
import { Group } from 'three'
import { shallow, useShallow } from 'zustand/shallow'

import { useDisplayEntityStore } from '@/stores/displayEntityStore'

import { BoundingBox } from './BoundingBox'

type DisplayEntityGroupProps = {
  id: string
  size: [number, number, number]
  position: [number, number, number]
  rotation: [number, number, number]
  onClick?: (event: ThreeEvent<MouseEvent>) => void
  objectRef?: MutableRefObject<Group>
}

const DisplayEntityGroup: FC<DisplayEntityGroupProps> = ({
  id,
  position,
  rotation,
  size,
  onClick,
  objectRef: ref,
}) => {
  const { thisEntitySelected } = useDisplayEntityStore(
    useShallow((state) => ({
      thisEntitySelected: state.selectedEntityIds.includes(id),
    })),
  )

  // 여러 엔티티들을 group할 때 group이 먼저 만들어지고 나서 각 그룹에서 useEffect로 parent를 변경하기 때문에
  // 그 전에 BoxHelper.update()를 호출할 경우 group의 children이 비어 있으므로 아무것도 그려지지 않음
  // 매 프레임마다 children의 개수를 확인하여 변경 사항이 있으면 그룹이 포함하는 테두리의 크기가 달라질 수 있으므로
  // BoxHelper update 필요

  // entity group이 처음 생겼을 경우 transformation 설정 (id와 ref는 바뀔 일이 거의 없음)
  // 그룹이 생성될 때 자동으로 선택되는데, 이 때문에 아래 useFrame 코드에서 entity의 transformation이 세팅되지 않아 (0, 0, 0)에 있는 문제를 해결결
  useEffect(() => {
    const thisEntity = useDisplayEntityStore.getState().entities.get(id)
    if (thisEntity == null) return

    const { position, rotation, size } = thisEntity

    if (ref?.current != null) {
      ref.current.position.set(...position)
      ref.current.rotation.set(...rotation)
      ref.current.scale.set(...size)

      ref.current.updateMatrix()
      ref.current.matrixWorldNeedsUpdate = true
      invalidate()
    }
  }, [id, ref])

  const prevTransformRef = useRef<{
    position: Number3Tuple
    rotation: Number3Tuple
    scale: Number3Tuple
  }>({
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  })

  // 매 프레임 렌더링 시마다 선택되어 있지 않을 경우 transformation 설정
  useFrame(() => {
    const {
      position: prevPosition,
      rotation: prevRotation,
      scale: prevScale,
    } = prevTransformRef.current
    if (
      shallow(prevPosition, position) &&
      shallow(prevRotation, rotation) &&
      shallow(prevScale, size)
    ) {
      // transform data is unchanged
      return
    }

    if (!thisEntitySelected && ref?.current != null) {
      ref.current.position.set(...position)
      ref.current.rotation.set(...rotation)
      ref.current.scale.set(...size)

      ref.current.updateMatrix()
      invalidate()

      prevTransformRef.current.position = position
      prevTransformRef.current.rotation = rotation
      prevTransformRef.current.scale = size
    }
  })

  return (
    <group
      ref={ref as MutableRefObject<Group>}
      name={`DisplayEntityGroup ${id}`}
      onClick={onClick}
      matrixAutoUpdate={false}
    >
      {/* 그룹 안에 들어가야 할 display entity들은 portal을 사용해서 이 안에서 렌더링됨 */}
      <BoundingBox
        object={ref?.current}
        visible={thisEntitySelected}
        color="green"
      />
    </group>
  )
}

export default DisplayEntityGroup
