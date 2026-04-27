import { useFrame } from '@react-three/fiber'
import { type FC, useEffect, useMemo, useRef } from 'react'
import {
  Box3,
  BoxHelper,
  type ColorRepresentation,
  Euler,
  MathUtils,
  Matrix4,
  Object3D,
  Vector3,
} from 'three'
import { useShallow } from 'zustand/shallow'

import {
  InstancedMeshManager,
  useInstancedMeshStore,
} from '@/stores/instancedMeshStore'

const dummyObject = new Object3D()
const infinityVector = new Vector3(Infinity, Infinity, Infinity)
const negativeInfinityVector = new Vector3(-Infinity, -Infinity, -Infinity)
const HalfBlockTranslatedXZVector = new Vector3(0.5, 0, 0.5)
const ReverseHalfBlockTranslatedXZVector = new Vector3(-0.5, 0, -0.5)

interface BoundingBoxProps {
  object?: Object3D
  visible: boolean
  color?: ColorRepresentation
}
export const BoundingBox: FC<BoundingBoxProps> = ({
  object,
  visible,
  color,
}) => {
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

interface BoundingBoxForInstancedProps {
  modelList: {
    resourceLocation: string
    xRotation?: number
    yRotation?: number
  }[]
  visible?: boolean
  color?: ColorRepresentation
}
export const BoundingBoxForInstanced: FC<BoundingBoxForInstancedProps> = ({
  modelList,
  visible = true,
  color,
}) => {
  // TODO: directly search batch by modelResourceLocation,
  // find batch mesh geometry boundingbox and expandByBox() it

  const box = useMemo(() => new Box3(), [])

  const batchGeometries = useInstancedMeshStore(
    useShallow((state) =>
      modelList.map((modelData) => {
        const minimalBatchInfo = state.batches.get(modelData.resourceLocation)
        if (minimalBatchInfo?.status !== 'ready') {
          return
        }

        const batches = InstancedMeshManager.instance.getBatch(
          modelData.resourceLocation,
        )
        if (batches?.status !== 'ready') {
          // this should not happen
          return
        }

        return batches.geometry
      }),
    ),
  )

  useEffect(() => {
    box.set(infinityVector, negativeInfinityVector)

    const _matrix = new Matrix4()
    const _euler = new Euler()

    for (let i = 0; i < modelList.length; i++) {
      const modelData = modelList[i]
      const geometry = batchGeometries[i]
      if (geometry == null) continue

      if (geometry.boundingBox == null) {
        geometry.computeBoundingBox()
      }

      // grab geometry bounding box connected to batch, and use that to calculate entity's bounding box
      const boundingBox = geometry.boundingBox!.clone()
      boundingBox
        .translate(ReverseHalfBlockTranslatedXZVector)
        .applyMatrix4(
          _matrix.makeRotationFromEuler(
            _euler.set(
              MathUtils.degToRad(-1 * (modelData.xRotation ?? 0)),
              MathUtils.degToRad(-1 * (modelData.yRotation ?? 0)),
              0,
            ),
          ),
        )
        .translate(HalfBlockTranslatedXZVector)

      box.union(boundingBox)
    }
  }, [box, modelList, batchGeometries])

  return (
    <box3Helper args={[box, color]} visible={visible} raycast={() => null} />
  )
}
