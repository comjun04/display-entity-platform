import { type FC, type ReactNode, useEffect, useRef, useState } from 'react'
import { LuCopyPlus, LuGroup, LuScan, LuTrash } from 'react-icons/lu'

import {
  cloneSelectedEntities,
  deleteEntities,
  groupEntities,
} from '@/lib/entities'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'

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
  const selectedEntityIds = useDisplayEntityStore(
    (state) => state.selectedEntityIds,
  )
  const someItemsSelected = selectedEntityIds.length > 0

  return (
    <ContextMenuContent className="min-w-48 origin-top-left">
      <ContextMenuItem
        disabled={!someItemsSelected}
        onClick={() => {
          cloneSelectedEntities()
        }}
      >
        <LuCopyPlus /> Duplicate
      </ContextMenuItem>
      <ContextMenuItem
        disabled={!someItemsSelected}
        onClick={() => {
          groupEntities(selectedEntityIds)
        }}
      >
        <LuGroup /> Group
      </ContextMenuItem>

      <ContextMenuSeparator />

      <ContextMenuItem
        onClick={() => {
          const { entities, setSelected } = useDisplayEntityStore.getState()
          const rootEntityIds = [...entities.values()]
            .filter((entity) => entity.parent == null)
            .map((entity) => entity.id)
          setSelected(rootEntityIds)
        }}
      >
        <LuScan /> Select All
      </ContextMenuItem>

      <ContextMenuSeparator />
      <ContextMenuItem
        variant="destructive"
        disabled={!someItemsSelected}
        onClick={() => {
          deleteEntities(selectedEntityIds)
        }}
      >
        <LuTrash /> Delete
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

  // disable context menu from triggering when dragging with right mouse button pressed
  // which acts as canvas panning
  useEffect(() => {
    const triggerElement = triggerRef.current
    const handle = (evt: MouseEvent) => {
      if (evt.buttons === 2) {
        setDisableMenu(true)
      } else {
        setDisableMenu(false)
      }
    }

    triggerElement?.addEventListener('mousemove', handle)
    return () => {
      triggerElement?.removeEventListener('mousemove', handle)
    }
  }, [])

  return (
    <ContextMenu disabled={disableMenu}>
      <ContextMenuTrigger className={className} ref={triggerRef}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContentArea />
    </ContextMenu>
  )
}

export default ContextMenuHandler
