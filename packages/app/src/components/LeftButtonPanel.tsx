import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { IoMove } from 'react-icons/io5'
import {
  LuMenu,
  LuMoveDiagonal,
  LuRedo,
  LuRotate3D,
  LuUndo,
} from 'react-icons/lu'
import { useShallow } from 'zustand/shallow'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { clearProject } from '@/lib/actions'
import {
  openFileFromUserSelect,
  saveAsBDEngineFile,
  saveToFile,
} from '@/lib/file-handler'
import { getLogger } from '@/lib/logger'
import { getFormattedShortcutKeyString } from '@/lib/utils'
import { useDialogStore } from '@/stores/dialogStore'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'

import FloatingButton from './FloatingButton'
import MobileDragHoldButton from './MobileDragHoldButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/DropdownMenu'

const logger = getLogger('LeftButtonPanel')

const LeftButtonPanel: FC = () => {
  const { t } = useTranslation()

  const {
    mode,
    setMode,
    rotationSpace,
    setRotationSpace,
    headPainterEnabled,
    shortcutSettings,
  } = useEditorStore(
    useShallow((state) => ({
      mode: state.mode,
      setMode: state.setMode,

      rotationSpace: state.rotationSpace,
      setRotationSpace: state.setRotationSpace,

      headPainterEnabled: state.headPainter.enabled,

      shortcutSettings: state.settings.shortcuts,
    })),
  )
  const { setOpenedDialog } = useDialogStore(
    useShallow((state) => ({ setOpenedDialog: state.openDialog })),
  )
  const { undoHistory, redoHistory } = useHistoryStore(
    useShallow((state) => ({
      undoHistory: state.undoHistory,
      redoHistory: state.redoHistory,
    })),
  )

  return (
    <div className="absolute top-0 left-0 z-5 mt-4 ml-4 flex flex-col items-start gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <FloatingButton>
              <LuMenu size={24} />
            </FloatingButton>
          }
        />
        <DropdownMenuContent
          side="right"
          sideOffset={10}
          align="start"
          className="origin-top-left sm:min-w-52"
        >
          <DropdownMenuItem
            className="w-full"
            onClick={() => void clearProject()}
          >
            <div className="flex w-full flex-row items-center gap-2 text-sm">
              <span className="grow">{t(($) => $.menu.newProject)}</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem className="w-full" onClick={openFileFromUserSelect}>
            <div className="flex w-full flex-row items-center gap-2 text-sm">
              <span className="grow">{t(($) => $.menu.open)}</span>
              <span className="text-xs text-neutral-500">
                {getFormattedShortcutKeyString(
                  shortcutSettings['general.openFromFile'] ?? '',
                )}
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="w-full"
            onClick={() => {
              saveToFile().catch((...err) => {
                logger.error('Unexpected error when saving to file:', ...err)
              })
            }}
          >
            <div className="flex w-full flex-row items-center gap-2 text-sm">
              <span className="grow">{t(($) => $.menu.save)}</span>
              <span className="text-xs text-neutral-500">
                {getFormattedShortcutKeyString(
                  shortcutSettings['general.saveToFile'] ?? '',
                )}
              </span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t(($) => $.menu.exportTo.title)}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className="block"
                onClick={() => setOpenedDialog('exportToMinecraft')}
              >
                <div className="text-sm">Minecraft</div>
                <div className="text-xs text-neutral-500">
                  {t(($) => $.menu.exportTo.submenu.minecraft.desc)}
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="block"
                onClick={() => {
                  saveAsBDEngineFile().catch(console.error)
                }}
              >
                <div className="text-sm">BDEngine</div>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="w-full"
            onClick={() => setOpenedDialog('welcome')}
          >
            <div className="flex w-full flex-row items-center gap-2 text-sm">
              <div className="grow">{t(($) => $.menu.welcome)}</div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="w-full"
            onClick={() => setOpenedDialog('settings')}
          >
            <div className="flex w-full flex-row items-center gap-2 text-sm">
              <div className="grow">{t(($) => $.menu.settings)}</div>
              <span className="text-xs text-neutral-500">
                {getFormattedShortcutKeyString(
                  shortcutSettings['general.openSettings'] ?? '',
                )}
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex flex-row gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <FloatingButton onClick={() => undoHistory()}>
                <LuUndo size={24} />
              </FloatingButton>
            }
          />
          <TooltipContent side="bottom">
            {`${t(($) => $.editor.undo)} (${getFormattedShortcutKeyString(
              shortcutSettings['general.undo'] ?? '',
            )})`}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <FloatingButton onClick={() => redoHistory()}>
                <LuRedo size={24} />
              </FloatingButton>
            }
          />
          <TooltipContent side="bottom">
            {`${t(($) => $.editor.redo)} (${getFormattedShortcutKeyString(
              shortcutSettings['general.redo'] ?? '',
            )})`}
          </TooltipContent>
        </Tooltip>
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <FloatingButton
              active={mode === 'translate'}
              disabled={headPainterEnabled}
              onClick={() => setMode('translate')}
            >
              <IoMove size={24} />
            </FloatingButton>
          }
        />
        <TooltipContent side="right">
          {`${t(($) => $.editor.modes.translate)} (${getFormattedShortcutKeyString(
            shortcutSettings['editor.translateMode'] ?? '',
          )})`}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <FloatingButton
              active={mode === 'rotate'}
              disabled={headPainterEnabled}
              onClick={() => setMode('rotate')}
            >
              <LuRotate3D size={24} />
            </FloatingButton>
          }
        />
        <TooltipContent side="right">
          {`${t(($) => $.editor.modes.rotate)} (${getFormattedShortcutKeyString(
            shortcutSettings['editor.rotateMode'] ?? '',
          )})`}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <FloatingButton
              active={mode === 'scale'}
              disabled={headPainterEnabled}
              onClick={() => setMode('scale')}
            >
              <LuMoveDiagonal size={24} />
            </FloatingButton>
          }
        />
        <TooltipContent side="right">
          {`${t(($) => $.editor.modes.scale)} (${getFormattedShortcutKeyString(
            shortcutSettings['editor.scaleMode'] ?? '',
          )})`}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          render={
            <FloatingButton
              onClick={() => {
                setRotationSpace(rotationSpace === 'world' ? 'local' : 'world')
              }}
            >
              {rotationSpace === 'world' ? 'World' : 'Local'}
            </FloatingButton>
          }
        />
        <TooltipContent side="right">
          {t(($) => $.editor.changeSpaceMode)}
        </TooltipContent>
      </Tooltip>

      {/* dummy element just to make spacing */}
      <div />

      <MobileDragHoldButton />
    </div>
  )
}

export default LeftButtonPanel
