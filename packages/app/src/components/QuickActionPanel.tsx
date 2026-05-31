import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { IoMdTrash } from 'react-icons/io'
import { IoCubeOutline } from 'react-icons/io5'
import {
  LuBrush,
  LuChevronDown,
  LuCopyPlus,
  LuGroup,
  LuPlus,
  LuSmile,
  LuType,
  LuUngroup,
} from 'react-icons/lu'
import { TbDiamondFilled } from 'react-icons/tb'
import { useShallow } from 'zustand/shallow'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toggleGroup } from '@/lib/actions'
import {
  cloneSelectedEntities,
  createNewEntities,
  deleteEntities,
} from '@/lib/entities'
import { useDialogStore } from '@/stores/dialogStore'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'

import FloatingButton from './FloatingButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/DropdownMenu'

const QuickActionPanel: FC = () => {
  const { t } = useTranslation()

  const { setOpenedDialog } = useDialogStore(
    useShallow((state) => ({
      setOpenedDialog: state.openDialog,
    })),
  )
  const { selectedEntityIds, singleSelectedEntityIsGrouped } =
    useDisplayEntityStore(
      useShallow((state) => ({
        selectedEntityIds: state.selectedEntityIds,
        singleSelectedEntityIsGrouped:
          state.selectedEntityIds.length === 1 &&
          state.entities.get(state.selectedEntityIds[0])?.kind === 'group',
      })),
    )
  const headPainterEnabled = useEditorStore(
    (state) => state.headPainter.enabled,
  )

  const { panelLocation, panelMargin } = useEditorStore(
    useShallow((state) => ({
      panelLocation: state.settings.appearance.quickActionPanel.location,
      panelMargin: state.settings.appearance.quickActionPanel.margin,
    })),
  )

  return (
    <div
      className="absolute left-1/2 z-5 -translate-x-1/2"
      style={{
        top: panelLocation === 'top' ? panelMargin : undefined,
        bottom: panelLocation === 'bottom' ? panelMargin : undefined,
      }}
    >
      <div className="flex flex-row rounded-lg bg-black">
        {/* Desktop - show all 'Add Display Entity' buttons */}
        <div className="hidden flex-row sm:flex">
          <Tooltip>
            <TooltipTrigger
              render={
                <FloatingButton
                  disabled={headPainterEnabled}
                  onClick={() => {
                    setOpenedDialog('blockDisplaySelect')
                  }}
                >
                  <IoCubeOutline size={24} />
                </FloatingButton>
              }
            />
            <TooltipContent side="bottom">
              {t(($) => $.editor.topBar.blockDisplay)}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <FloatingButton
                  onClick={() => {
                    setOpenedDialog('itemDisplaySelect')
                  }}
                >
                  <TbDiamondFilled size={24} />
                </FloatingButton>
              }
            />
            <TooltipContent side="bottom">
              {t(($) => $.editor.topBar.itemDisplay)}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <FloatingButton
                  onClick={() => {
                    createNewEntities([
                      { kind: 'text', text: 'Enter Text' },
                    ]).catch(console.error)
                  }}
                >
                  <LuType size={24} />
                </FloatingButton>
              }
            />
            <TooltipContent side="bottom">
              {t(($) => $.editor.topBar.textDisplay)}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <FloatingButton
                  onClick={() => {
                    createNewEntities([
                      { kind: 'item', type: 'player_head' },
                    ]).catch(console.error)
                  }}
                >
                  <LuSmile size={24} />
                </FloatingButton>
              }
            />
            <TooltipContent side="bottom">
              {t(($) => $.editor.topBar.addPlayerHead)}
            </TooltipContent>
          </Tooltip>
        </div>
        {/* Mobile - show dropdown menu for 'Add Display Entity' action */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <FloatingButton className="flex flex-row items-center gap-1 sm:hidden">
                <LuPlus size={24} />
                <LuChevronDown size={16} />
              </FloatingButton>
            }
            disabled={headPainterEnabled}
          />
          <DropdownMenuContent
            side="bottom"
            align="start"
            className="origin-top-left"
          >
            <DropdownMenuItem
              className="flex flex-row items-center gap-2"
              onClick={() => {
                setOpenedDialog('blockDisplaySelect')
              }}
            >
              <IoCubeOutline />
              {t(($) => $.editor.topBar.blockDisplay)}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex flex-row items-center gap-2"
              onClick={() => {
                setOpenedDialog('itemDisplaySelect')
              }}
            >
              <TbDiamondFilled />

              {t(($) => $.editor.topBar.itemDisplay)}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex flex-row items-center gap-2"
              onClick={() => {
                createNewEntities([{ kind: 'text', text: 'Enter Text' }]).catch(
                  console.error,
                )
              }}
            >
              <LuType />

              {t(($) => $.editor.topBar.textDisplay)}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex flex-row items-center gap-2"
              onClick={() => {
                createNewEntities([
                  { kind: 'item', type: 'player_head' },
                ]).catch(console.error)
              }}
            >
              <LuSmile />

              {t(($) => $.editor.topBar.addPlayerHead)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="my-2 border-l border-gray-700" />

        <Tooltip>
          <TooltipTrigger
            render={
              <FloatingButton
                onClick={() => {
                  const {
                    headPainter: {
                      enabled: headPainterEnabled,
                      setEnabled: setHeadPainterEnabled,
                    },
                  } = useEditorStore.getState()
                  setHeadPainterEnabled(!headPainterEnabled)
                }}
              >
                <LuBrush size={24} />
              </FloatingButton>
            }
          />
          <TooltipContent side="bottom">
            {t(($) => $.editor.topBar.headPainterMode)}
          </TooltipContent>
        </Tooltip>

        <div className="my-2 border-l border-gray-700" />

        <Tooltip>
          <TooltipTrigger
            render={
              <FloatingButton
                disabled={selectedEntityIds.length < 1}
                onClick={() => cloneSelectedEntities()}
              >
                <LuCopyPlus size={24} />
              </FloatingButton>
            }
          />
          <TooltipContent side="bottom">
            {t(($) => $.editor.topBar.duplicate)}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              singleSelectedEntityIsGrouped ? (
                <FloatingButton onClick={toggleGroup}>
                  <LuUngroup size={24} />
                </FloatingButton>
              ) : (
                <FloatingButton
                  disabled={selectedEntityIds.length < 1}
                  onClick={toggleGroup}
                >
                  <LuGroup size={24} />
                </FloatingButton>
              )
            }
          />
          <TooltipContent side="bottom">
            {t(($) =>
              singleSelectedEntityIsGrouped
                ? $.editor.topBar.ungroup
                : $.editor.topBar.group,
            )}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <FloatingButton
                onClick={() => {
                  deleteEntities(selectedEntityIds)
                }}
              >
                <IoMdTrash size={24} />
              </FloatingButton>
            }
          />
          <TooltipContent side="bottom">
            {t(($) => $.editor.topBar.delete)}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

export default QuickActionPanel
