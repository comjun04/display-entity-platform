import { type FC, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IoCubeOutline } from 'react-icons/io5'
import { LuChevronRight, LuSmile, LuType } from 'react-icons/lu'
import { TbDiamondFilled } from 'react-icons/tb'
import { useShallow } from 'zustand/shallow'

import { cn } from '@/lib/utils'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'

import { SidePanel, SidePanelContent, SidePanelTitle } from './panel-base'

type ObjectItemProps = {
  id: string
}
const ObjectItem: FC<ObjectItemProps> = ({ id }) => {
  const {
    kind,
    type,
    textDisplayText,
    display,
    blockstates,
    selected,
    children,
    groupName,
    playerHeadProperties,
  } = useDisplayEntityStore(
    useShallow((state) => {
      const entity = state.entities.get(id)!

      return {
        kind: entity.kind,
        type: 'type' in entity ? entity.type : undefined,
        textDisplayText: 'text' in entity ? entity.text : undefined,
        display: 'display' in entity ? entity.display : null,
        blockstates: entity.kind === 'block' ? entity.blockstates : undefined,
        selected: state.selectedEntityIds.includes(id),

        parent: entity.parent,
        children: entity.kind === 'group' ? entity.children : null,

        groupName: entity.kind === 'group' ? entity.name : undefined,

        playerHeadProperties:
          entity.kind === 'item' ? entity.playerHeadProperties : undefined,
      }
    }),
  )
  const thisOrChildSelected = useDisplayEntityStore((state) =>
    state.selectedEntityIdsIncludingParent.has(id),
  )

  const showEntityIdFirst = useEditorStore(
    (state) => state.settings.debug.showEntityIdOnObjectPanel,
  )

  const blockstateArr: string[] = []
  if (kind === 'block') {
    for (const key in blockstates!) {
      blockstateArr.push(`${key}=${blockstates[key]}`)
    }
  }

  const itemName =
    kind === 'group'
      ? groupName || 'Group'
      : kind === 'text'
        ? textDisplayText
        : type

  const [manuallyExpandGroup, setManuallyExpandGroup] = useState(false)
  const expandGroupChildren =
    kind === 'group' &&
    children != null &&
    (thisOrChildSelected || manuallyExpandGroup)

  return (
    <div className="border-l-2 border-neutral-700 pl-1">
      <div
        className={cn(
          'flex cursor-pointer flex-row items-center gap-1',
          selected && [
            'font-bold',
            kind === 'group' ? 'text-green-500' : 'text-yellow-500',
          ],
        )}
        onClick={(evt) => {
          const { addToSelected: addToSelectedEntity, setSelected } =
            useDisplayEntityStore.getState()

          if (evt.ctrlKey) {
            const { entities, selectedEntityIds } =
              useDisplayEntityStore.getState()

            if (selectedEntityIds.length < 1) {
              addToSelectedEntity(id)
              return
            }

            const thisEntity = entities.get(id)
            if (thisEntity == null) return

            // 같은 parent 내의 object만 다중 선택 가능
            const selectedEntityParent = [...entities.values()].find((e) =>
              selectedEntityIds.includes(e.id),
            )!.parent
            if (thisEntity.parent === selectedEntityParent) {
              addToSelectedEntity(id)
              return
            }
          }

          setSelected([id])
        }}
      >
        <span
          className={cn(
            'flex flex-none items-center transition-transform duration-200',
            expandGroupChildren && 'rotate-90',
          )}
        >
          {kind === 'block' && <IoCubeOutline size={16} />}
          {kind === 'item' &&
            (type === 'player_head' ? (
              <LuSmile size={16} />
            ) : (
              <TbDiamondFilled size={16} />
            ))}
          {kind === 'text' && <LuType size={16} />}
          {kind === 'group' && (
            <button
              onClick={(evt) => {
                evt.stopPropagation()
                setManuallyExpandGroup((state) => !state)
              }}
            >
              <LuChevronRight size={16} />
            </button>
          )}
        </span>
        <span className="flex flex-none gap-1">
          {showEntityIdFirst && <span className="font-mono">{id}</span>}
          {itemName}
          {blockstateArr.length > 0 && (
            <span className="truncate opacity-50">
              [{blockstateArr.join(',')}]
            </span>
          )}
          {kind === 'item' && display != null && (
            <span className="truncate opacity-50">[display={display}]</span>
          )}
        </span>

        {playerHeadProperties?.texture?.baked === false && (
          <div className="rounded-sm bg-neutral-700 px-1 py-0.5 text-xs text-gray-400">
            Painted
          </div>
        )}
      </div>

      {expandGroupChildren && (
        <div className="pl-4">
          {children.map((entityId) => (
            <ObjectItem key={entityId} id={entityId} />
          ))}
        </div>
      )}
    </div>
  )
}

const ObjectsPanel: FC = () => {
  const { t } = useTranslation()

  const rootEntityIds = useDisplayEntityStore(
    useShallow((state) =>
      [...state.entities.values()]
        .filter((e) => e.parent == null)
        .map((entity) => entity.id),
    ),
  )

  // handle resizable panel
  const contentRef = useRef<HTMLDivElement>(null)
  const objectsRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLButtonElement>(null)
  const dragStart = useRef<{ y: number; height: number } | null>(null)
  const [contentHeight, setContentHeight] = useState<number | null>(null)

  const resizeContent = (height: number) => {
    const objects = objectsRef.current
    const handle = handleRef.current
    if (!objects || !handle) return

    const maxHeight = window.innerHeight * 0.8
    const minHeight = Math.min(
      objects.scrollHeight + handle.offsetHeight,
      maxHeight,
    )
    setContentHeight(Math.max(minHeight, Math.min(height, maxHeight)))
  }

  return (
    <SidePanel>
      <SidePanelTitle>{t(($) => $.sidebar.objectsPanel.title)}</SidePanelTitle>
      <SidePanelContent
        ref={contentRef}
        className="flex max-h-[80dvh] min-h-0 flex-col overflow-hidden"
        style={{
          height: contentHeight ?? undefined,
        }}
      >
        <div className="min-h-0 flex-1 overflow-auto">
          <div ref={objectsRef}>
            {rootEntityIds.map((id) => (
              <ObjectItem key={id} id={id} />
            ))}
          </div>
        </div>
        <button
          ref={handleRef}
          type="button"
          aria-label="Resize objects panel"
          className="flex h-3 w-full shrink-0 cursor-ns-resize touch-none items-center justify-center rounded-sm text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300 focus-visible:outline-2 focus-visible:outline-white"
          onPointerDown={(evt) => {
            if (evt.button !== 0) return
            evt.preventDefault()
            dragStart.current = {
              y: evt.clientY,
              height: contentRef.current?.getBoundingClientRect().height ?? 0,
            }
            evt.currentTarget.setPointerCapture(evt.pointerId)
          }}
          onPointerMove={(evt) => {
            const start = dragStart.current
            if (start) resizeContent(start.height + evt.clientY - start.y)
          }}
          onPointerUp={(evt) => {
            const start = dragStart.current
            if (start) resizeContent(start.height + evt.clientY - start.y)
            dragStart.current = null
            evt.currentTarget.releasePointerCapture(evt.pointerId)
          }}
          onPointerCancel={() => {
            dragStart.current = null
          }}
          onKeyDown={(evt) => {
            if (evt.key !== 'ArrowUp' && evt.key !== 'ArrowDown') return
            evt.preventDefault()
            const height =
              contentHeight ??
              contentRef.current?.getBoundingClientRect().height ??
              0
            resizeContent(height + (evt.key === 'ArrowDown' ? 24 : -24))
          }}
        >
          <span className="h-1 w-8 rounded-full bg-current" />
        </button>
      </SidePanelContent>
    </SidePanel>
  )
}

export default ObjectsPanel
