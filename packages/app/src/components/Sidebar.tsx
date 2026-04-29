import { useDebouncedEffect } from '@react-hookz/web'
import { type FC, useEffect, useState } from 'react'
import { LuEllipsisVertical } from 'react-icons/lu'
import { useShallow } from 'zustand/shallow'

import { cn } from '../lib/utils'
import { useEditorStore } from '../stores/editorStore'
import HeadPainterPanel from './sidebar/HeadPainterPanel'
import ObjectsPanel from './sidebar/ObjectsPanel'
import PropertiesPanel from './sidebar/PropertiesPanel'
import TransformsPanel from './sidebar/TransformsPanel'

const Sidebar: FC = () => {
  const {
    mobileSidebarOpened,
    setMobileSidebarOpened,
    initialDesktopSidebarWidth,
    headPainterEnabled,
  } = useEditorStore(
    useShallow((state) => ({
      mobileSidebarOpened: state.mobileSidebarOpened,
      setMobileSidebarOpened: state.setMobileSidebarOpened,
      initialDesktopSidebarWidth: state.settings.appearance.sidebar.width,
      headPainterEnabled: state.headPainter.enabled,
    })),
  )

  const [desktopSidebarWidth, setDesktopSidebarWidth] = useState(
    initialDesktopSidebarWidth,
  )
  const [handlerDragging, setHandlerDragging] = useState(false)

  // resize desktop sidebar width on drag
  useEffect(() => {
    const handlePointerMove = (evt: PointerEvent) => {
      const newWidth = Math.min(
        window.innerWidth - evt.clientX,
        (window.innerWidth / 10) * 8,
      )
      setDesktopSidebarWidth(newWidth)
    }
    const handlePointerUp = () => {
      setHandlerDragging(false)
    }

    if (handlerDragging) {
      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
    } else {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlerDragging])

  // resize desktop sidebar width on window width change
  useEffect(() => {
    const handler = () => {
      const newWidth = Math.min(
        desktopSidebarWidth,
        (window.innerWidth / 10) * 8,
      )
      setDesktopSidebarWidth(newWidth)
    }

    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('resize', handler)
    }
  }, [desktopSidebarWidth])

  // save sidebar width to settings on idle state
  useDebouncedEffect(
    () => {
      useEditorStore.getState().setSettings({
        appearance: {
          sidebar: { width: desktopSidebarWidth },
        },
      })
    },
    [desktopSidebarWidth],
    500,
  )

  return (
    <>
      {/* backdrop, used when sidebar shows like overlay (mobile) */}
      <div
        className={cn(
          'absolute top-0 right-0 z-40 h-full w-full bg-black/50 transition duration-200 sm:hidden',
          mobileSidebarOpened ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setMobileSidebarOpened(false)}
      />

      <div
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-full max-w-75 bg-neutral-800 p-2 transition duration-200 ease-out sm:relative sm:max-w-none',
          !mobileSidebarOpened && 'translate-x-full sm:translate-x-0',
        )}
        style={{
          width: desktopSidebarWidth,
        }}
      >
        {/* sidebar resize handler */}
        <div
          className="fixed top-[20%] left-0 hidden h-12 w-3 -translate-x-3 cursor-ew-resize touch-none flex-col items-center justify-center rounded-l-lg bg-neutral-900 text-gray-500 sm:flex"
          onPointerDownCapture={() => {
            setHandlerDragging(true)
          }}
          onPointerUpCapture={() => {
            setHandlerDragging(false)
          }}
        >
          <LuEllipsisVertical />
        </div>

        <div className="flex h-full flex-col gap-2 overflow-y-auto">
          <ObjectsPanel />
          {headPainterEnabled && <HeadPainterPanel />}
          <TransformsPanel />
          <PropertiesPanel />
        </div>
      </div>
    </>
  )
}

export default Sidebar
