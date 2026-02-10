import { useFrame } from '@react-three/fiber'
import { type FC, useRef } from 'react'
import { BoxHelper, type ColorRepresentation, Matrix4, Object3D } from 'three'

const dummyObject = new Object3D()

type BoundingBoxProps = {
  object?: Object3D
  visible: boolean
  color?: ColorRepresentation
}

const BoundingBox: FC<BoundingBoxProps> = ({ object, visible, color }) => {
  const boxHelperRef = useRef<BoxHelper>(null)

  useFrame(() => {
    if (object == null || boxHelperRef.current == null) return
    if (!visible) return

    // transformation 초기 상태에 있어야 제대로 위치와 크기 계산을 하므로
    // 임시로 parent를 빼고 transformation 건드리기
    const parent = object.parent
    if (parent != null) {
      parent.remove(object)
    }
    // BoxHelper도 빼야 시작지점이 (0,0,0)이 아닌 경우를 제대로 핸들링함
    object.remove(boxHelperRef.current)

    // BoxHelper가 object의 transformation이 초기 상태일 때만 위치와 크기를 제대로 계산하는 것으로 보임
    // 따라서 초기 상태로 만든 다음 setFromObject() 호출 후 되돌리기
    const m = object.matrix.clone()
    const freshMatrix = new Matrix4()
    freshMatrix.decompose(object.position, object.quaternion, object.scale)

    boxHelperRef.current.setFromObject(object)

    m.decompose(object.position, object.quaternion, object.scale)
    object.updateMatrix()

    // Prevent the helpers from blocking rays
    boxHelperRef.current.traverse((child) => (child.raycast = () => null))

    // BoxHelper 뺀 거 다시 넣기
    object.add(boxHelperRef.current)

    if (parent != null) {
      parent.add(object)
    }

    object.updateMatrixWorld() // needed to correctly calculate world matrix after all jobs
  })

  return (
    <boxHelper
      args={[dummyObject, color]}
      visible={visible}
      ref={boxHelperRef}
      // disable click detection for BoxHelper (r3f automatically enables it by default)
      raycast={() => {}}
    />
  )
}

export default BoundingBox
