import type { ModelDisplayPositionKey, Number3Tuple } from '@depl/shared'
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
  Quaternion,
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

const OriginVec = new Vector3()
const DisplayTranslationMinVec = new Vector3(-80, -80, -80)
const DisplayTranslationMaxVec = new Vector3(80, 80, 80)

const IdentityMatrix = new Matrix4()
const HalfBlockTranslatedMatrix = new Matrix4().makeTranslation(0.5, 0.5, 0.5)
const ReverseHalfBlockTranslatedMatrix = new Matrix4().makeTranslation(
  -0.5,
  -0.5,
  -0.5,
)

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
    const matrixBackup = object.matrix.clone()
    IdentityMatrix.decompose(object.position, object.quaternion, object.scale)
    object.updateMatrix()

    boxHelperRef.current.setFromObject(object)

    matrixBackup.decompose(object.position, object.quaternion, object.scale)
    object.updateMatrix()

    // Prevent the helpers from blocking rays
    boxHelperRef.current.traverse((child) => (child.raycast = () => null))

    // BoxHelper 뺀 거 다시 넣기
    object.add(boxHelperRef.current)

    if (parent != null) {
      parent.add(object)
    }

    object.updateWorldMatrix(true, true) // needed to correctly calculate world matrix after all jobs
  })

  return (
    <boxHelper
      args={[dummyObject, color]}
      visible={visible}
      ref={boxHelperRef}
      // disable click detection for BoxHelper (r3f automatically enables it by default)
      raycast={() => {}}
      matrixAutoUpdate={false}
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
  displayType?: ModelDisplayPositionKey
}
export const BoundingBoxForInstanced: FC<BoundingBoxForInstancedProps> = ({
  modelList,
  visible = true,
  color,
  displayType,
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
  const batchDisplayInfos = useInstancedMeshStore(
    useShallow((state) =>
      modelList.map((modelData) => {
        const minimalBatchInfo = state.batches.get(modelData.resourceLocation)
        if (minimalBatchInfo?.status !== 'ready') {
          return
        }

        const batch = InstancedMeshManager.instance.getBatch(
          modelData.resourceLocation,
        )
        if (batch?.status !== 'ready') {
          // this should not happen
          return
        }

        return batch.display
      }),
    ),
  )

  useEffect(() => {
    box.set(infinityVector, negativeInfinityVector)

    const _matrix = new Matrix4()
    const _matrix2 = new Matrix4()
    const _euler = new Euler()
    const _displayTranslation = new Vector3()
    const _displayScale = new Vector3()

    for (let i = 0; i < modelList.length; i++) {
      const modelData = modelList[i]
      const geometry = batchGeometries[i]
      const displayInfos = batchDisplayInfos[i]
      if (geometry == null || displayInfos == null) continue

      if (geometry.boundingBox == null) {
        geometry.computeBoundingBox()
      }

      const displayInfo =
        displayType != null ? (displayInfos[displayType] ?? {}) : {}
      _displayTranslation
        .set(...(displayInfo.translation ?? [0, 0, 0]))
        .max(DisplayTranslationMinVec)
        .min(DisplayTranslationMaxVec)
        .divideScalar(16)
      _displayScale.set(...(displayInfo.scale ?? [1, 1, 1]))
      const displayRotation = (displayInfo.rotation ?? [0, 0, 0]).map((d) =>
        MathUtils.degToRad(d),
      ) as Number3Tuple

      // grab geometry bounding box connected to batch, and use that to calculate entity's bounding box
      const boundingBox = geometry.boundingBox!.clone()

      _matrix
        .makeTranslation(_displayTranslation) // set display translation first
        .premultiply(
          // set display rotation and scale
          _matrix2.compose(
            OriginVec,
            new Quaternion().setFromEuler(new Euler(...displayRotation)),
            _displayScale,
          ),
        )
        .premultiply(ReverseHalfBlockTranslatedMatrix)
        .premultiply(
          _matrix2.makeRotationFromEuler(
            _euler.set(
              MathUtils.degToRad(-1 * (modelData.xRotation ?? 0)),
              MathUtils.degToRad(-1 * (modelData.yRotation ?? 0)),
              0,
            ),
          ),
        )
        .premultiply(HalfBlockTranslatedMatrix)
      boundingBox.applyMatrix4(_matrix)

      box.union(boundingBox)
    }
  }, [box, modelList, batchGeometries, batchDisplayInfos, displayType])

  return (
    <box3Helper args={[box, color]} visible={visible} raycast={() => null} />
  )
}
