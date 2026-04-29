// Base code is from @react-three/drei `Select` component
// https://github.com/pmndrs/drei/blob/adae93761fa0925c2ee80b30dcb2f903e6d11f3c/src/web/Select.tsx
import { invalidate, useThree } from '@react-three/fiber'
import { type FC, useEffect, useRef } from 'react'
import { Group, Vector2, Vector3 } from 'three'
import { shallow } from 'zustand/shallow'

import { cn } from '@/lib/utils'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import { useEntityRefStore } from '@/stores/entityRefStore'

import { SelectionBox } from './SelectionBox'

type DragSelectControlProps = {
  selectionBoxClassname?: string
}

const DragSelectControl: FC<DragSelectControlProps> = ({
  selectionBoxClassname,
}) => {
  const { camera, scene, controls, gl, size } = useThree()

  const groupRef = useRef<Group>(null)

  useEffect(() => {
    const selectionBox = new SelectionBox(camera, scene)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const oldControlsEnabled = (controls as any)?.enabled

    let isPointerDown = false

    // JSX 형태로 return하면 r3f element가 아니라는 오류가 발생하므로
    // element를 따로 생성해서 붙이는 방식을 사용
    const element = document.createElement('div')
    element.className = cn(
      'pointer-events-none fixed border-2 border-neutral-500/50 bg-neutral-500/20',
      selectionBoxClassname,
    )

    const startPoint = new Vector2()
    const pointTopLeft = new Vector2()
    const pointBottomRight = new Vector2()

    const prepareRay = (posVec: Vector2, targetVec: Vector3) => {
      const { width, height } = size
      targetVec.set(
        (posVec.x / width) * 2 - 1,
        -(posVec.y / height) * 2 + 1,
        0.5, // unused
      )
    }

    const updateSelectedList = () => {
      const entityRefsArray = [
        ...useEntityRefStore.getState().entityRefs.values(),
      ]
      const allSelectedRefData = selectionBox
        .select()
        .map((o) =>
          entityRefsArray.find((d) => d.objectRef.current.id === o.id),
        )
        .filter((o) => o != null)

      const { selectedEntityIds, setSelected } =
        useDisplayEntityStore.getState()
      const newSelectedEntityIds = allSelectedRefData.map((d) => d.id)
      if (
        newSelectedEntityIds.length > 0 &&
        !shallow(selectedEntityIds, newSelectedEntityIds) // shallow equal
      ) {
        setSelected(newSelectedEntityIds)
      }
    }

    const pointerDown = (evt: PointerEvent) => {
      const { mobileDragHoldButtonPressed } = useEditorStore.getState()
      if (!evt.ctrlKey && !mobileDragHoldButtonPressed) return

      // canvas 공간 밖에서 드래그를 시작했을 경우 처리하지 않음
      const canvasElement = gl.domElement
      if (
        evt.clientX < canvasElement.clientLeft ||
        evt.clientY < canvasElement.clientTop ||
        evt.clientX > canvasElement.clientLeft + canvasElement.clientWidth ||
        evt.clientY > canvasElement.clientTop + canvasElement.clientHeight
      )
        return

      isPointerDown = true
      gl.domElement.parentElement?.appendChild(element)

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      if (controls) (controls as any).enabled = false

      startPoint.x = evt.clientX
      startPoint.y = evt.clientY

      element.style.left = `${evt.clientX}px`
      element.style.top = `${evt.clientY}px`
      element.style.width = '0px'
      element.style.height = '0px'
    }
    const pointerUp = () => {
      if (!isPointerDown) return

      isPointerDown = false
      element.parentElement?.removeChild(element)

      if (controls != null) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        ;(controls as any).enabled = oldControlsEnabled
        invalidate()
      }

      prepareRay(pointTopLeft, selectionBox.startPoint)
      prepareRay(pointBottomRight, selectionBox.endPoint)
      updateSelectedList()
    }
    const pointerMove = (evt: PointerEvent) => {
      if (!isPointerDown) return

      const canvasElement = gl.domElement

      pointTopLeft.x = Math.max(
        Math.min(evt.clientX, startPoint.x),
        canvasElement.clientLeft,
      )
      pointTopLeft.y = Math.max(
        Math.min(evt.clientY, startPoint.y),
        canvasElement.clientTop,
      )
      pointBottomRight.x = Math.min(
        Math.max(evt.clientX, startPoint.x),
        canvasElement.clientLeft + canvasElement.clientWidth,
      )
      pointBottomRight.y = Math.min(
        Math.max(evt.clientY, startPoint.y),
        canvasElement.clientTop + canvasElement.clientHeight,
      )

      element.style.left = `${pointTopLeft.x}px`
      element.style.top = `${pointTopLeft.y}px`
      element.style.width = `${pointBottomRight.x - pointTopLeft.x}px`
      element.style.height = `${pointBottomRight.y - pointTopLeft.y}px`
    }

    document.addEventListener('pointerdown', pointerDown, { passive: true })
    document.addEventListener('pointermove', pointerMove, { passive: true })
    document.addEventListener('pointerup', pointerUp, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', pointerDown)
      document.removeEventListener('pointermove', pointerMove)
      document.removeEventListener('pointerup', pointerUp)

      element.parentElement?.removeChild(element)
    }
  }, [camera, controls, gl, scene, selectionBoxClassname, size])

  return <group ref={groupRef} />
}

export default DragSelectControl
