import { CameraControls } from '@react-three/drei'
import OriginalCameraControls from 'camera-controls'
import { type FC, useEffect, useRef, useState } from 'react'

const CustomCameraControls: FC = () => {
  const [shiftPressed, setShiftPressed] = useState(false)

  const controlRef = useRef<CameraControls>(null!)

  useEffect(() => {
    const handleKeyDown = (evt: KeyboardEvent) => {
      if (evt.shiftKey) {
        setShiftPressed(true)
      }
    }

    const handleKeyUp = (evt: KeyboardEvent) => {
      if (!evt.shiftKey) {
        setShiftPressed(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  })

  return (
    <CameraControls
      makeDefault
      smoothTime={0}
      draggingSmoothTime={0.025}
      maxZoom={1}
      ref={controlRef}
      onStart={() => {
        controlRef.current.mouseButtons.left = shiftPressed
          ? OriginalCameraControls.ACTION.TRUCK
          : OriginalCameraControls.ACTION.ROTATE
      }}
    />
  )
}

export default CustomCameraControls
