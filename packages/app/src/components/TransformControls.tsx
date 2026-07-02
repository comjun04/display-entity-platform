import { TransformControls as TransformControlsImpl } from '@react-three/drei'
import { invalidate } from '@react-three/fiber'
import {
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Box3,
  Box3Helper,
  BoxGeometry,
  Euler,
  type Event,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three'
import { TransformControls as OriginalTransformControls } from 'three/examples/jsm/Addons.js'
import { useShallow } from 'zustand/shallow'

import { batchSetEntityTransformation } from '@/lib/entities'
import { getLogger } from '@/lib/logger'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import { useEntityRefStore } from '@/stores/entityRefStore'
import type { Number3Tuple } from '@/types/base'

const SCALE_SNAP = 0.0625

const infinityVector = new Vector3(Infinity, Infinity, Infinity)
const minusInfinityVector = new Vector3(-Infinity, -Infinity, -Infinity)
const dummyBox = new Box3(infinityVector.clone(), minusInfinityVector.clone())

const logger = getLogger('TransformControls')

const TransformControls: FC = () => {
  const { selectedEntityIds } = useDisplayEntityStore(
    useShallow((state) => ({
      selectedEntityIds: state.selectedEntityIds,
    })),
  )
  const firstSelectedEntityTransformation = useDisplayEntityStore(
    useShallow((state) => {
      const firstSelectedEntityId = state.selectedEntityIds[0]
      if (firstSelectedEntityId == null) return null

      const firstSelectedEntity = state.entities.get(firstSelectedEntityId)
      if (firstSelectedEntity == null) return null

      const { position, rotation, size } = firstSelectedEntity
      return { position, rotation, size }
    }),
  )

  const firstSelectedEntityId =
    selectedEntityIds.length > 0 ? selectedEntityIds[0] : null

  const { firstSelectedEntityRefData } = useEntityRefStore(
    useShallow((state) => ({
      firstSelectedEntityRefData:
        firstSelectedEntityId != null
          ? state.entityRefs.get(firstSelectedEntityId)
          : undefined,
    })),
  )
  const {
    mode,
    rotationSpace,
    setUsingTransformControl,
    setSelectionBaseTransformation,
    needsSelectedEntitiesInitialTransformationsUpdate,
    showPivotIndicator,
  } = useEditorStore(
    useShallow((state) => ({
      mode: state.mode,
      rotationSpace: state.rotationSpace,
      setUsingTransformControl: state.setUsingTransformControl,
      setSelectionBaseTransformation: state.setSelectionBaseTransformation,
      needsSelectedEntitiesInitialTransformationsUpdate:
        state.transformControl.needsSelectedEntitiesTransformationUpdate,
      showPivotIndicator: state.settings.debug.showPivotIndicator,
    })),
  )

  const [shiftPressed, setShiftPressed] = useState(false)

  const pivot = useMemo(() => {
    const group = new Group()
    group.name = 'Pivot'
    return group
  }, [])
  const pivotDebugIndicator = useMemo(() => {
    const geo = new BoxGeometry(0.2, 0.2, 0.2)
    const mat = new MeshStandardMaterial()
    const mesh = new Mesh(geo, mat)
    return mesh
  }, [])
  const boundingBoxHelperRef = useRef<Box3Helper>(null)

  const pivotInitialPosition = useRef(new Vector3())
  const pivotInitialQuaternion = useRef(new Quaternion())
  const pivotInitialQuaternionWorld = useRef(new Quaternion())
  const selectedEntityInitialTransformations = useRef<
    {
      id: string
      object: Object3D
      position: Vector3
      quaternion: Quaternion
      scale: Vector3
    }[]
  >([])

  // add pivotDebugIndicator to pivot on mount
  useEffect(() => {
    pivot.add(pivotDebugIndicator)
    return () => {
      pivot.remove(pivotDebugIndicator)
    }
  }, [pivot, pivotDebugIndicator])
  useEffect(() => {
    pivotDebugIndicator.visible = showPivotIndicator
    invalidate()
  }, [pivotDebugIndicator, showPivotIndicator])

  const updateBoundingBox = useCallback(() => {
    if (boundingBoxHelperRef.current == null) return

    const box = boundingBoxHelperRef.current.box
    box.set(infinityVector.clone(), minusInfinityVector.clone()) // 넓이 초기화

    selectedEntityIds.forEach((entityId) => {
      const refData = useEntityRefStore.getState().entityRefs.get(entityId)!
      if (refData.objectRef.current != null) {
        box.expandByObject(refData.objectRef.current)
      }
    })
  }, [selectedEntityIds])

  const updateSelectedEntityInitialTransformations = useCallback(() => {
    const { entities, selectedEntityIds } = useDisplayEntityStore.getState()
    const selectedEntities = [...entities.values()].filter((e) =>
      selectedEntityIds.includes(e.id),
    )

    selectedEntityInitialTransformations.current = []

    const tempEuler = new Euler()
    for (const entity of selectedEntities) {
      const refData = useEntityRefStore.getState().entityRefs.get(entity.id)!
      const object = refData.objectRef.current

      const positionVec = new Vector3(...entity.position)
      const rotationQuat = new Quaternion().setFromEuler(
        tempEuler.set(...entity.rotation),
      )
      const scaleVec = new Vector3(...entity.size)

      selectedEntityInitialTransformations.current.push({
        id: entity.id,
        object,
        position: positionVec,
        quaternion: rotationQuat,
        scale: scaleVec,
      })
    }
  }, [])

  // reparent pivot when first selected entity is changed
  useEffect(() => {
    logger.debug('reparenting pivot')
    const { rootGroupRefData } = useEntityRefStore.getState()

    if (firstSelectedEntityRefData != null) {
      const parent =
        firstSelectedEntityRefData.objectRef.current.parent ??
        rootGroupRefData.objectRef.current
      parent.add(pivot)
    } else {
      const parent = rootGroupRefData.objectRef.current
      parent.add(pivot)
    }
  }, [firstSelectedEntityRefData, pivot])

  // update when selected entity changes
  useEffect(() => {
    updateSelectedEntityInitialTransformations()

    // selection bounding box shows when multiple entities are selected
    if (selectedEntityIds.length > 1) {
      updateBoundingBox()
    }
  }, [
    selectedEntityIds,
    updateSelectedEntityInitialTransformations,
    updateBoundingBox,
  ])

  // updates when selected entities' transformations changes outside of TransformControls
  useEffect(() => {
    if (needsSelectedEntitiesInitialTransformationsUpdate) {
      updateSelectedEntityInitialTransformations()
      updateBoundingBox()

      useEditorStore
        .getState()
        .transformControl.setSelectedEntitiesTransformationUpdateFlag(false)
    }
  }, [
    needsSelectedEntitiesInitialTransformationsUpdate,
    updateSelectedEntityInitialTransformations,
    updateBoundingBox,
  ])

  // update pivot position and rotation when first selected entity's transform data changed
  useEffect(() => {
    if (firstSelectedEntityTransformation == null) return

    pivot.position.set(...firstSelectedEntityTransformation.position)
    pivot.rotation.set(...firstSelectedEntityTransformation.rotation)
    pivot.scale.set(1, 1, 1)
    pivot.updateMatrix()

    pivotInitialPosition.current.copy(pivot.position)
    pivotInitialQuaternion.current.copy(pivot.quaternion)
    pivot.getWorldQuaternion(pivotInitialQuaternionWorld.current)

    logger.debug(
      'updating pivot position and rotation on firstSelectedEntityTransformation change',
      pivot.position.toArray(),
      pivot.rotation.toArray(),
    )
  }, [firstSelectedEntityTransformation, pivot])

  useEffect(() => {
    const handler = (evt: KeyboardEvent) => {
      setShiftPressed(evt.shiftKey)
    }

    document.addEventListener('keydown', handler)
    document.addEventListener('keyup', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      document.removeEventListener('keyup', handler)
    }
  }, [])

  return (
    <>
      <TransformControlsImpl
        object={pivot}
        mode={mode}
        space={rotationSpace}
        translationSnap={shiftPressed ? 0.00125 : 0.0625}
        rotationSnap={shiftPressed ? Math.PI / 180 : Math.PI / 12} // 1deg when shift pressed, 15deg otherwise
        scaleSnap={0.0625}
        // visible={selectedEntity != null} // 왜인지 모르겠는데 작동 안함
        showX={selectedEntityIds.length > 0}
        showY={selectedEntityIds.length > 0}
        showZ={selectedEntityIds.length > 0}
        enabled={selectedEntityIds.length > 0}
        onMouseDown={() => {
          setUsingTransformControl(true)
          logger.debug('onMouseDown')

          // TODO: iterate over selected entities, update position/rotation/scale
          // from displayEntityStore state to selectedEntityInitialTransformation ref storage
          // This fixes the bug where manually changing selected entities' transformation data using TransformationPanel on sidebar and moving with dragging
          // causes selected entities to be teleported weirdly because selectedEntityInitialTransformation holds old values on displayEntityStore state change

          for (const initialTransform of selectedEntityInitialTransformations.current) {
            initialTransform.position.copy(initialTransform.object.position)
            initialTransform.quaternion.copy(initialTransform.object.quaternion)
            initialTransform.scale.copy(initialTransform.object.scale)
          }
        }}
        onMouseUp={() => {
          setUsingTransformControl(false)
          logger.debug('onMouseUp')

          const entities = useDisplayEntityStore.getState().entities

          if (mode === 'translate') {
            const batchUpdateData = [...entities.values()]
              .filter((e) => selectedEntityIds.includes(e.id))
              .map((entity) => {
                const initialTransform =
                  selectedEntityInitialTransformations.current.find(
                    (d) => d.id === entity.id,
                  )!

                const entityRefPosition = initialTransform.object.position
                initialTransform.position.copy(entityRefPosition)

                return {
                  id: entity.id,
                  translation: entityRefPosition.toArray(),
                }
              })
            batchSetEntityTransformation(batchUpdateData)
          } else if (mode === 'rotate') {
            const tempEuler = new Euler()
            const batchUpdateData = [...entities.values()]
              .filter((e) => selectedEntityIds.includes(e.id))
              .map((entity) => {
                const initialTransform =
                  selectedEntityInitialTransformations.current.find(
                    (d) => d.id === entity.id,
                  )!

                const newPosition = initialTransform.object.position

                const newRotationQuaternion = initialTransform.object.quaternion
                const newRotationEulerArr = tempEuler
                  .setFromQuaternion(newRotationQuaternion)
                  .toArray()
                  .slice(0, 3) as Number3Tuple

                initialTransform.position.copy(newPosition)
                initialTransform.quaternion.copy(newRotationQuaternion)

                return {
                  id: entity.id,
                  rotation: newRotationEulerArr,
                  translation: newPosition.toArray(),
                }
              })

            batchSetEntityTransformation(batchUpdateData)
          } else if (mode === 'scale') {
            const batchUpdateData = [...entities.values()]
              .filter((e) => selectedEntityIds.includes(e.id))
              .map((entity) => {
                const initialTransform =
                  selectedEntityInitialTransformations.current.find(
                    (d) => d.id === entity.id,
                  )!

                const newScale = new Vector3()
                initialTransform.object.getWorldScale(newScale)

                // 다중 선택되어 있을 경우 그룹 중심점과 떨어져 있는 object들은 scale 시 위치가 달라짐
                // 따라서 world location을 별도로 계산하여 state에 반영
                const newPosition = initialTransform.object.position

                initialTransform.position.copy(newPosition)
                initialTransform.scale.copy(newScale)

                return {
                  id: entity.id,
                  scale: newScale.toArray(),
                  translation: newPosition.toArray(),
                }
              })
            batchSetEntityTransformation(batchUpdateData)
          }

          pivotInitialPosition.current.copy(pivot.position)
          pivotInitialQuaternion.current.copy(pivot.quaternion)
          pivot.getWorldQuaternion(pivotInitialQuaternionWorld.current)

          pivot.scale.set(1, 1, 1)
        }}
        onObjectChange={(e) => {
          const target = (e as Event<string, OriginalTransformControls>).target
          // scale은 양수 값만 가질 수 있음
          const absoluteScale = target.object.scale
            .toArray()
            .map(Math.abs) as Number3Tuple
          // state를 건드리기 전에 object3d에 먼저 scale 값을 세팅해야 음수 값일 경우 음수 <-> 양수로 계속 바뀌면서 생기는 깜빡거림을 방지할 수 있음
          target.object.scale.fromArray(absoluteScale)

          const pivotQuat = pivot.quaternion.clone()
          const pivotQuatDelta = pivotQuat
            .clone()
            .multiply(pivotInitialQuaternion.current.clone().invert())

          const pivotWorldQuat = new Quaternion()
          pivot.getWorldQuaternion(pivotWorldQuat)

          // share objects inside loop instead of creating new one every iteration
          const relativePosFromPivot = new Vector3()
          const newPos = new Vector3()
          const newQuat = new Quaternion()

          const alteredScale = new Vector3()
          const scaleToApply = new Vector3()

          const sharedParent =
            selectedEntityInitialTransformations.current[0].object.parent!

          // 1. Get the shared parent's world quaternion
          const parentQuatWorld = new Quaternion()
          sharedParent.getWorldQuaternion(parentQuatWorld)

          // 2. Precompute conversion (used for all children)
          for (const transformData of selectedEntityInitialTransformations.current) {
            if (mode !== 'scale') {
              relativePosFromPivot
                .copy(transformData.position)
                .sub(pivotInitialPosition.current)

              if (mode === 'rotate') {
                // apply pivot quaternion delta to object initial quaternion
                newQuat.copy(pivotQuatDelta).multiply(transformData.quaternion)
                transformData.object.quaternion.copy(newQuat)
              }

              // FIXME: rotating an object inside scaled parent makes object stretched when rotated

              newPos
                .copy(relativePosFromPivot)
                .applyQuaternion(pivotQuatDelta)
                .add(pivot.position)

              transformData.object.position.copy(newPos)
            } else {
              alteredScale.copy(transformData.scale).multiply(pivot.scale)
              scaleToApply.copy(transformData.scale)
              ;(['x', 'y', 'z'] as const).forEach((axis) => {
                if (
                  target.axis != null &&
                  target.axis.toLowerCase().includes(axis)
                ) {
                  const initialAxisScale = transformData.scale[axis]
                  const axisScaleDiff = alteredScale[axis] - initialAxisScale

                  let finalAxisScale =
                    initialAxisScale +
                    Math.round(axisScaleDiff / SCALE_SNAP) * SCALE_SNAP
                  finalAxisScale = Math.max(
                    Math.abs(finalAxisScale),
                    Number.EPSILON,
                  )

                  scaleToApply[axis] = finalAxisScale
                }
              })

              transformData.object.scale.copy(scaleToApply)
            }

            // manually update matrix since matrixAutoUpdate is disabled on entities
            transformData.object.updateMatrix()
          }

          if (selectedEntityIds.length > 0) {
            const firstSelectedEntityRefData = useEntityRefStore
              .getState()
              .entityRefs.get(selectedEntityIds[0])!

            setSelectionBaseTransformation({
              position:
                firstSelectedEntityRefData.objectRef.current.position.toArray(),
              rotation: firstSelectedEntityRefData.objectRef.current.rotation
                .toArray()
                .slice(0, 3) as [number, number, number],
              size: firstSelectedEntityRefData.objectRef.current.scale.toArray(),
            })
          }

          // update box
          updateBoundingBox()
        }}
      />

      <box3Helper
        args={[dummyBox, 'white']}
        visible={selectedEntityIds.length > 1}
        ref={boundingBoxHelperRef}
      />
    </>
  )
}

export default TransformControls
