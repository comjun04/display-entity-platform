import {
  GizmoHelper,
  GizmoViewport,
  Grid,
  PerspectiveCamera,
} from '@react-three/drei'
import { Canvas, invalidate, useThree } from '@react-three/fiber'
import { type FC, Suspense, lazy, useEffect, useRef } from 'react'
import { type AxesHelper, Color, DoubleSide } from 'three'
import type { Controls } from 'three'
import { useShallow } from 'zustand/shallow'

import { useDisplayEntityStore } from '../stores/displayEntityStore'
import { useEditorStore } from '../stores/editorStore'
import { useHistoryStore } from '../stores/historyStore'
import CustomCameraControls from './CustomCameraControls'
import DisplayentitiesRootGroup from './DisplayEntitiesRootGroup'
import DragSelectControl from './DragSelectControl'
import { InstancedMeshesRootGroup } from './InstancedMeshesRootGroup'
import ShortcutHandler from './ShortcutHandler'
import TransformControls from './TransformControls'

const Perf = lazy(() => import('./Perf'))

const InsideCanvas: FC = () => {
  const controls = useThree((state) => state.controls) as Controls<object>

  // silence eslint errors due to use of `any`
  useEffect(() => {
    if (controls == null) return

    let oldControlsEnabled = controls.enabled
    let headPainting = useEditorStore.getState().headPainter.nowPainting

    const setControlsForHeadPainting = (painting: boolean) => {
      if (painting) {
        oldControlsEnabled = controls.enabled
        // Setting CameraControls.enabled to false also cancels an active drag.
        controls.enabled = false
      } else if (!controls.enabled) {
        controls.enabled = oldControlsEnabled
      }
    }

    setControlsForHeadPainting(headPainting)

    // Store subscriptions run synchronously. This cancels CameraControls during
    // the painter's pointerdown handler instead of waiting for a React effect,
    // which could allow a pointermove through on slower devices.
    const unsubscribe = useEditorStore.subscribe((state) => {
      const nextHeadPainting = state.headPainter.nowPainting
      if (nextHeadPainting === headPainting) return

      headPainting = nextHeadPainting
      setControlsForHeadPainting(headPainting)
    })

    return unsubscribe
  }, [controls])

  useEffect(() => {
    const fn = () => {
      const { nowPainting } = useEditorStore.getState().headPainter
      if (!nowPainting) return

      useEditorStore.getState().headPainter.setNowPainting(false)
      useHistoryStore.getState().playerHead.flushToHistory()
    }

    document.addEventListener('pointerup', fn)
    return () => {
      document.removeEventListener('pointerup', fn)
    }
  }, [])

  return null
}

const AxesColors = [
  0xdc2626, // tailwind v3 red-600
  0x16a34a, // tailwind v3 green-600
  0x2563eb, // tailwind v3 blue-600
] as const
interface AxesProps {
  lineScale: number
}
const Axes: FC<AxesProps> = ({ lineScale }) => {
  const ref = useRef<AxesHelper>(null)

  useEffect(() => {
    ref.current?.setColors(...AxesColors)
  }, [])

  return <axesHelper args={[lineScale]} ref={ref} matrixAutoUpdate={false} />
}

const Scene: FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const {
    perfMonitorEnabled,
    reducePixelRatio,
    headPainterEnabled,
    gizmoLocation,
    gizmoMarginWidth,
    gizmoMarginHeight,
  } = useEditorStore(
    useShallow((state) => ({
      perfMonitorEnabled: state.settings.debug.perfMonitorEnabled,
      reducePixelRatio: state.settings.performance.reducePixelRatio,
      headPainterEnabled: state.headPainter.enabled,
      gizmoLocation: state.settings.appearance.gizmo.location,
      gizmoMarginWidth: state.settings.appearance.gizmo.marginWidth,
      gizmoMarginHeight: state.settings.appearance.gizmo.marginHeight,
    })),
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const preventDefault = (e: Event) => e.preventDefault()

    canvas.addEventListener('touchmove', preventDefault, { passive: false })
    canvas.addEventListener('gesturestart', preventDefault, { passive: false }) // For Safari

    return () => {
      canvas.removeEventListener('touchmove', preventDefault)
      canvas.removeEventListener('gesturestart', preventDefault)
    }
  }, [])

  return (
    <Canvas
      ref={canvasRef}
      frameloop="demand"
      scene={{
        background: new Color(0x222222),
        matrixAutoUpdate: false,
      }}
      gl={{
        antialias: false,
        alpha: false,
      }}
      style={{
        touchAction: 'none',
      }}
      dpr={reducePixelRatio ? Math.min(window.devicePixelRatio, 1) : undefined}
      onPointerDown={() => {
        // frameloop="demand"일 경우 가끔 TransformControls가 작동하지 않는 경우가 발생하는데
        // 이를 방지하기 위해 클릭 시 강제로 다음 프레임 렌더링하도록 하여 다시 작동하도록 고치기
        invalidate()
      }}
      onPointerMissed={(evt) => {
        // 모바일환경에서 TransformControls 잡은 상태로 꾹 누르고 있으면 contextmenu(우클릭) pointer event가 여기로 호출되는데
        // 이때 TransformControls는 아직 잡혀 있는데 선택이 풀리면서 상태가 꼬여버리므로 이를 방지
        if (evt.type !== 'contextmenu') {
          useDisplayEntityStore.getState().setSelected([])
        }
      }}
    >
      <InsideCanvas />

      <Grid
        visible={!headPainterEnabled}
        cellSize={1 / 16}
        cellColor={0x777777}
        sectionColor={0x333333}
        sectionSize={1}
        infiniteGrid
        side={DoubleSide}
      />

      <Axes lineScale={500} />
      {/* negative side */}
      <Axes lineScale={-500} />

      <DisplayentitiesRootGroup />
      <InstancedMeshesRootGroup />

      <TransformControls />
      <DragSelectControl />

      <ShortcutHandler />

      <ambientLight intensity={1.7} color={0xffffff} />
      <directionalLight position={[0, 10, 6]} />
      <directionalLight position={[0, 10, -6]} />

      <PerspectiveCamera makeDefault position={[3, 3, 3]}>
        <CustomCameraControls />
      </PerspectiveCamera>

      <GizmoHelper
        alignment={gizmoLocation}
        margin={[gizmoMarginWidth, gizmoMarginHeight]}
      >
        <GizmoViewport />
      </GizmoHelper>

      {perfMonitorEnabled && (
        <Suspense>
          <Perf />
        </Suspense>
      )}
    </Canvas>
  )
}

export default Scene
