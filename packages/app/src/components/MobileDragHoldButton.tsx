import { type FC, useState } from 'react'
import {
  LuSquareDashedMousePointer,
  LuSquareMousePointer,
} from 'react-icons/lu'
import { useShallow } from 'zustand/shallow'

import { cn } from '@/lib/utils'
import { useEditorStore } from '@/stores/editorStore'

import FloatingButton from './FloatingButton'

const MobileDragHoldButton: FC = () => {
  const [alwaysDragMode, setAlwaysDragMode] = useState(false)
  const [pointerDownTime, setPointerDownTime] = useState(Date.now())

  const { mobileDragHoldButtonPressed, setMobileDragHoldButtonPressed } =
    useEditorStore(
      useShallow((state) => ({
        mobileDragHoldButtonPressed: state.mobileDragHoldButtonPressed,
        setMobileDragHoldButtonPressed: state.setMobileDragHoldButtonPressed,
      })),
    )

  return (
    <FloatingButton
      className={cn(
        'sm:hidden',
        !alwaysDragMode && mobileDragHoldButtonPressed && 'bg-gray-800',
      )}
      active={alwaysDragMode}
      onPointerDown={() => {
        setPointerDownTime(Date.now())
        setMobileDragHoldButtonPressed(true)
      }}
      onPointerLeave={() => {
        setMobileDragHoldButtonPressed(false)
        if (Date.now() - pointerDownTime <= 150) {
          // 짧게 눌렀다 뗀 경우 모드 변경
          setAlwaysDragMode((mode) => {
            const newMode = !mode
            setMobileDragHoldButtonPressed(newMode)
            return newMode
          })
        }
      }}
    >
      {alwaysDragMode ? (
        <LuSquareMousePointer size={24} />
      ) : (
        <LuSquareDashedMousePointer size={24} />
      )}
    </FloatingButton>
  )
}

export default MobileDragHoldButton
