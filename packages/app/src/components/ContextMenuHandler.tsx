import { type FC, type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LuClipboard,
  LuCopy,
  LuCopyPlus,
  LuGroup,
  LuScan,
  LuTrash,
} from 'react-icons/lu'

import { copySelectedEntities, pasteCopiedEntities } from '@/lib/clipboard'
import {
  cloneSelectedEntities,
  deleteEntities,
  groupEntities,
} from '@/lib/entities'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu'

// split actual context menu content to prevent rendering context menu trigger item
// when context menu content needs to be rerendered by external data change
const ContextMenuContentArea: FC = () => {
  const { t } = useTranslation()

  const selectedEntityIds = useDisplayEntityStore(
    (state) => state.selectedEntityIds,
  )
  const someItemsSelected = selectedEntityIds.length > 0

  const clipboardDataExists = useEditorStore(
    (state) => state.clipboard.data.length > 0,
  )

  return (
    <ContextMenuContent className="min-w-48 origin-top-left">
      <ContextMenuItem
        disabled={!someItemsSelected}
        onClick={() => copySelectedEntities()}
      >
        <LuCopy /> {t(($) => $.contextMenu.copy)}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!clipboardDataExists}
        onClick={() => pasteCopiedEntities()}
      >
        <LuClipboard /> {t(($) => $.contextMenu.paste)}
      </ContextMenuItem>

      <ContextMenuItem
        onClick={() => {
          const { entities, setSelected } = useDisplayEntityStore.getState()
          const rootEntityIds = [...entities.values()]
            .filter((entity) => entity.parent == null)
            .map((entity) => entity.id)
          setSelected(rootEntityIds)
        }}
      >
        <LuScan /> {t(($) => $.contextMenu.selectAll)}
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem
        disabled={!someItemsSelected}
        onClick={() => {
          cloneSelectedEntities()
        }}
      >
        <LuCopyPlus /> {t(($) => $.contextMenu.duplicate)}
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!someItemsSelected}
        onClick={() => {
          groupEntities(selectedEntityIds)
        }}
      >
        <LuGroup /> {t(($) => $.contextMenu.group)}
      </ContextMenuItem>

      <ContextMenuSeparator />
      <ContextMenuItem
        variant="destructive"
        disabled={!someItemsSelected}
        onClick={() => {
          deleteEntities(selectedEntityIds)
        }}
      >
        <LuTrash /> {t(($) => $.contextMenu.delete)}
      </ContextMenuItem>
    </ContextMenuContent>
  )
}

interface ContextMenuHandlerProps {
  children: ReactNode
  triggerClassName?: string
}
const ContextMenuHandler: FC<ContextMenuHandlerProps> = ({
  children,
  triggerClassName: className,
}) => {
  const [disableMenu, setDisableMenu] = useState(false)

  const triggerRef = useRef<HTMLDivElement>(null)

  // disable context menu from triggering when user performs canvas panning action
  // detect dragging with right mouse button pressed, dragging with multiple touches on mobile
  useEffect(() => {
    const triggerElement = triggerRef.current
    const handleMouseMove = (evt: MouseEvent) => {
      if (evt.buttons === 2) {
        setDisableMenu(true)
      } else {
        setDisableMenu(false)
      }
    }

    const handleTouchStart = (evt: TouchEvent) => {
      if (evt.touches.length >= 2) {
        setDisableMenu(true)
      } else {
        setDisableMenu(false)
      }
    }
    const handleTouchEnd = (evt: TouchEvent) => {
      if (evt.touches.length < 2) {
        setDisableMenu(false)
      }
    }

    triggerElement?.addEventListener('mousemove', handleMouseMove)
    triggerElement?.addEventListener('touchstart', handleTouchStart)
    triggerElement?.addEventListener('touchend', handleTouchEnd)
    triggerElement?.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      triggerElement?.removeEventListener('mousemove', handleMouseMove)
      triggerElement?.removeEventListener('touchstart', handleTouchStart)
      triggerElement?.removeEventListener('touchend', handleTouchEnd)
      triggerElement?.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [])

  return (
    <ContextMenu
      disabled={disableMenu}
      onOpenChange={(open, details) => {
        if (open && details.reason === 'trigger-press' && disableMenu) {
          details.cancel()
        }
      }}
    >
      <ContextMenuTrigger className={className} ref={triggerRef}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContentArea />
    </ContextMenu>
  )
}

export default ContextMenuHandler
