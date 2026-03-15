import { useSet } from '@react-hookz/web'
import {
  type FC,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { LuCheck, LuEraser, LuUndo } from 'react-icons/lu'

import {
  Tooltip as CustomTooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Settings } from '@/lib/settings'
import { cn, getFormattedShortcutKeyString } from '@/lib/utils'
import { useEditorStore } from '@/stores/editorStore'

const SPECIAL_KEYS = ['Control', 'Alt', 'Shift']
const BLOCKED_KEYS = ['Unidentified']
function isValidKeyCombo(keys: string[]) {
  return (
    keys.length < 1 || // pass if keybind is unset
    (keys.some((key) => !SPECIAL_KEYS.includes(key)) &&
      keys.every((key) => !BLOCKED_KEYS.includes(key)))
  )
}

const ShortcutSettingsContext = createContext<{
  currentlyEditingKeyId: string | null
  setCurrentlyEditingKeyId: (newKey: string | null) => void
}>({
  currentlyEditingKeyId: null,
  setCurrentlyEditingKeyId: () => {},
})

interface ShortcutKeyInputProps {
  id: keyof Settings['shortcuts']
}
const ShortcutKeyInput: FC<ShortcutKeyInputProps> = ({ id }) => {
  const { t } = useTranslation()

  const rawKeysStr = useEditorStore(
    (state) => state.settings.shortcuts[id] ?? '',
  )

  const { currentlyEditingKeyId, setCurrentlyEditingKeyId } = useContext(
    ShortcutSettingsContext,
  )
  const editMode = currentlyEditingKeyId === id

  const pressedKeys = useSet<string>(rawKeysStr.split(' '))
  const shortcutUnset = pressedKeys.size < 1

  const keyList = editMode ? [...pressedKeys.values()] : rawKeysStr.split(' ')
  const validKeyCombination = isValidKeyCombo(keyList)
  const formattedKeysStr = getFormattedShortcutKeyString(keyList)

  const saveChanges = useCallback(() => {
    const newKeys = [...pressedKeys.values()].map((key) => {
      if (key.length === 1) {
        return key.toLowerCase()
      }

      return key
    })
    if (newKeys.length > 0 && !isValidKeyCombo(newKeys)) {
      return false
    }

    const newKeysStr = newKeys.length > 0 ? newKeys.join(' ') : null
    useEditorStore.getState().setSettings({
      shortcuts: {
        [id]: newKeysStr,
      },
    })

    return true
  }, [id, pressedKeys])

  useEffect(() => {
    // pre-fill pressedKeys with current value
    // to avoid flickering between editMode change and this effect run
    if (!editMode) {
      pressedKeys.clear()
      rawKeysStr.split(' ').forEach((key) => {
        if (key.length > 0) pressedKeys.add(key)
      })
    }
  }, [editMode, pressedKeys, rawKeysStr])

  // detect key input on edit mode
  useEffect(() => {
    const handler = (evt: KeyboardEvent) => {
      if (!editMode) return

      if (evt.key === 'Enter') {
        if (saveChanges()) {
          // if save successful, exit edit mode
          setCurrentlyEditingKeyId(null)
        }
        return
      } else if (evt.key === 'Escape') {
        // discard changes
        setCurrentlyEditingKeyId(null)
        return
      }

      pressedKeys.clear()
      if (evt.ctrlKey) {
        pressedKeys.add('Control')
      }
      if (evt.altKey) {
        pressedKeys.add('Alt')
      }
      if (evt.shiftKey) {
        pressedKeys.add('Shift')
      }
      pressedKeys.add(evt.key)
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [editMode, pressedKeys, setCurrentlyEditingKeyId, saveChanges])

  return (
    <div
      className={cn(
        'group relative w-full max-w-48 rounded-sm border-2 border-transparent bg-neutral-700/70 px-2 py-1 transition-colors',
        editMode && 'border-neutral-400',
        shortcutUnset && 'text-gray-500 italic',
        !validKeyCombination && 'bg-red-500/30',
      )}
      onClick={() => {
        if (editMode) {
          saveChanges()
        }
        setCurrentlyEditingKeyId(editMode ? null : id)
      }}
    >
      <span>
        {shortcutUnset
          ? t(($) => $.dialog.settings.page.shortcuts.unset)
          : formattedKeysStr}
      </span>
      <div
        className={cn(
          'absolute top-1/2 right-1 flex -translate-y-1/2 flex-row items-center rounded-sm bg-neutral-800/70 text-white transition duration-150',
          'pointer-events-none opacity-0',
          editMode && 'group-hover:pointer-events-auto group-hover:opacity-100',
        )}
      >
        <CustomTooltip>
          <TooltipTrigger
            delay={0}
            render={
              <button
                className="rounded-sm p-1 transition-colors duration-150 hover:bg-neutral-900"
                onClick={(evt) => {
                  evt.stopPropagation()

                  // discard changes
                  setCurrentlyEditingKeyId(null)
                }}
              >
                <LuUndo size={14} />
              </button>
            }
          />
          <TooltipContent side="top">
            {t(($) => $.dialog.settings.page.shortcuts.buttons.undo)}
          </TooltipContent>
        </CustomTooltip>

        <CustomTooltip>
          <TooltipTrigger
            delay={0}
            render={
              <button
                className="rounded-sm p-1 transition-colors duration-150 hover:bg-neutral-900"
                onClick={(evt) => {
                  evt.stopPropagation()

                  // set keybind as unset
                  pressedKeys.clear()
                }}
              >
                <LuEraser size={14} />
              </button>
            }
          />
          <TooltipContent side="top">
            {t(($) => $.dialog.settings.page.shortcuts.buttons.unset)}
          </TooltipContent>
        </CustomTooltip>

        <CustomTooltip>
          <TooltipTrigger
            delay={0}
            render={
              <button
                className="rounded-sm p-1 transition-colors duration-150 hover:bg-neutral-900"
                onClick={(evt) => {
                  evt.stopPropagation()

                  // save changes
                  if (saveChanges()) {
                    setCurrentlyEditingKeyId(null)
                  }
                }}
              >
                <LuCheck size={14} />
              </button>
            }
          />
          <TooltipContent side="top">
            {t(($) => $.dialog.settings.page.shortcuts.buttons.save)}
          </TooltipContent>
        </CustomTooltip>
      </div>
    </div>
  )
}

const ShortcutsPage: FC = () => {
  const { t } = useTranslation()

  const [currentlyEditingKey, setCurrentlyEditingKey] = useState<string | null>(
    null,
  )

  return (
    <ShortcutSettingsContext.Provider
      value={{
        currentlyEditingKeyId: currentlyEditingKey,
        setCurrentlyEditingKeyId: setCurrentlyEditingKey,
      }}
    >
      <h3 className="text-xl font-bold">
        {t(($) => $.dialog.settings.page.shortcuts.title)}
      </h3>
      <div className="text-gray-500">
        {t(($) => $.dialog.settings.page.shortcuts.desc)}
      </div>
      <div className="mt-2 flex flex-row items-center gap-2 rounded-sm bg-neutral-700 px-3 py-2">
        <span className="grow">
          {t(($) => $.dialog.settings.page.shortcuts.howto)}
        </span>
      </div>
      <div className="mt-2 rounded-sm bg-yellow-800 px-3 py-2">
        {t(($) => $.dialog.settings.page.shortcuts.shortcutNotWorkInThisPage)}
      </div>
      <div className="mt-2">
        <div className="rounded-sm bg-neutral-800 px-3 py-1 text-gray-400">
          {t(($) => $.dialog.settings.page.shortcuts.categories.general.title)}
        </div>
        <div className="flex flex-col">
          <div className="mt-1 flex flex-row items-center gap-2">
            <span className="grow px-3">
              {t(
                ($) =>
                  $.dialog.settings.page.shortcuts.categories.general.items
                    .openFromFile,
              )}
            </span>
            <ShortcutKeyInput id="general.openFromFile" />
          </div>
          <div className="mt-1 flex flex-row items-center gap-2">
            <span className="grow px-3">
              {t(
                ($) =>
                  $.dialog.settings.page.shortcuts.categories.general.items
                    .saveToFile,
              )}
            </span>
            <ShortcutKeyInput id="general.saveToFile" />
          </div>
          <div className="mt-1 flex flex-row items-center gap-2">
            <span className="grow px-3">
              {t(
                ($) =>
                  $.dialog.settings.page.shortcuts.categories.general.items
                    .openSettings,
              )}
            </span>
            <ShortcutKeyInput id="general.openSettings" />
          </div>
          <div className="mt-1 flex flex-row items-center gap-2">
            <span className="grow px-3">
              {t(
                ($) =>
                  $.dialog.settings.page.shortcuts.categories.general.items
                    .undo,
              )}
            </span>
            <ShortcutKeyInput id="general.undo" />
          </div>
          <div className="mt-1 flex flex-row items-center gap-2">
            <span className="grow px-3">
              {t(
                ($) =>
                  $.dialog.settings.page.shortcuts.categories.general.items
                    .redo,
              )}
            </span>
            <ShortcutKeyInput id="general.redo" />
          </div>
        </div>
      </div>
      <div className="mt-1">
        <div className="rounded-sm bg-neutral-800 px-3 py-1 text-gray-400">
          {t(($) => $.dialog.settings.page.shortcuts.categories.editor.title)}
        </div>
        <div className="flex flex-col">
          <div className="mt-1 flex flex-row items-center gap-2">
            <span className="grow px-3">
              {t(
                ($) =>
                  $.dialog.settings.page.shortcuts.categories.editor.items
                    .translateMode,
              )}
            </span>
            <ShortcutKeyInput id="editor.translateMode" />
          </div>
          <div className="mt-1 flex flex-row items-center gap-2">
            <span className="grow px-3">
              {t(
                ($) =>
                  $.dialog.settings.page.shortcuts.categories.editor.items
                    .rotateMode,
              )}
            </span>
            <ShortcutKeyInput id="editor.rotateMode" />
          </div>
          <div className="mt-1 flex flex-row items-center gap-2">
            <span className="grow px-3">
              {t(
                ($) =>
                  $.dialog.settings.page.shortcuts.categories.editor.items
                    .scaleMode,
              )}
            </span>
            <ShortcutKeyInput id="editor.scaleMode" />
          </div>
          <div className="mt-1 flex flex-row items-center gap-2">
            <span className="grow px-3">
              {t(
                ($) =>
                  $.dialog.settings.page.shortcuts.categories.editor.items
                    .duplicate,
              )}
            </span>
            <ShortcutKeyInput id="editor.duplicate" />
          </div>
          <div className="mt-1 flex flex-row items-center gap-2">
            <span className="grow px-3">
              {t(
                ($) =>
                  $.dialog.settings.page.shortcuts.categories.editor.items
                    .groupOrUngroup,
              )}
            </span>
            <ShortcutKeyInput id="editor.groupOrUngroup" />
          </div>
          <div className="mt-1 flex flex-row items-center gap-2">
            <span className="grow px-3">
              {t(
                ($) =>
                  $.dialog.settings.page.shortcuts.categories.editor.items
                    .deleteEntity,
              )}
            </span>
            <ShortcutKeyInput id="editor.deleteEntity" />
          </div>
        </div>
      </div>
    </ShortcutSettingsContext.Provider>
  )
}

export default ShortcutsPage
