import { type FC, useEffect, useMemo } from 'react'

import { toggleGroup } from '@/lib/actions'
import { openFileFromUserSelect, saveToFile } from '@/lib/file-handler'
import { getLogger } from '@/lib/logger'
import type { ShortcutActionsEnum } from '@/lib/settings'
import { useDialogStore } from '@/stores/dialogStore'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'

const logger = getLogger('ShortcutHandler')

const SPECIAL_KEYS = ['Control', 'Alt', 'Shift']

const ShortcutHandler: FC = () => {
  const shortcutRecord = useEditorStore((state) => state.settings.shortcuts)
  // Record<shortcutAction, shortcutKey[]>
  const shortcutReverseRecord = useMemo(() => {
    const record: Record<string, ShortcutActionsEnum[]> = {}
    for (const [shortcutAction, shortcutKeyStr] of Object.entries(
      shortcutRecord,
    )) {
      if (shortcutKeyStr == null) continue

      if (shortcutKeyStr in record) {
        record[shortcutKeyStr].push(shortcutAction as ShortcutActionsEnum)
      } else {
        record[shortcutKeyStr] = [shortcutAction as ShortcutActionsEnum]
      }
    }

    return record
  }, [shortcutRecord])

  useEffect(() => {
    const focusableElements = ['input', 'textarea']
    const { undoHistory, redoHistory } = useHistoryStore.getState()

    const handler = (evt: KeyboardEvent) => {
      const { activeDialog: openedDialog, openDialog: setOpenedDialog } =
        useDialogStore.getState()

      // prevent default browser actions first
      // ctrl + o (open file)
      // ctrl + s (save page)
      // ctrl + p (print page)
      if (['p', 'o', 's'].includes(evt.key.toLowerCase()) && evt.ctrlKey) {
        evt.preventDefault()
      }

      // <input>이나 <textarea>에 focus가 잡혀 있다면 이벤트를 처리하지 않음
      if (
        focusableElements.includes(
          (document.activeElement?.tagName ?? '').toLowerCase(),
        )
      ) {
        return true
      }

      // dialog 창이 열려 있을 떄는 이벤트를 처리하지 않음
      if (openedDialog != null) {
        return true
      }

      const { selectedEntityIds, deleteEntities, duplicateSelected } =
        useDisplayEntityStore.getState()
      const { setMode } = useEditorStore.getState()

      const keyArr: string[] = []
      if (evt.ctrlKey) {
        keyArr.push('Control')
      }
      if (evt.altKey) {
        keyArr.push('Alt')
      }
      if (evt.shiftKey) {
        keyArr.push('Shift')
      }

      if (!SPECIAL_KEYS.includes(evt.key)) {
        // single alphabetical keys can be detected as uppercase when combined with Shift key
        // so change to lowercase to match with savedata
        keyArr.push(evt.key.length === 1 ? evt.key.toLowerCase() : evt.key)
      }

      const keyStr = keyArr.join(' ')

      const associatedActions = shortcutReverseRecord[keyStr]
      if (associatedActions == null) {
        return
      }

      // process shortcut associated action
      for (const action of associatedActions) {
        switch (action) {
          // general
          case 'general.openFromFile':
            evt.preventDefault()
            openFileFromUserSelect()
            break
          case 'general.saveToFile':
            evt.preventDefault()
            saveToFile().catch((...err) => {
              logger.error('Unexpected error when saving to file:', ...err)
            })
            break
          case 'general.openSettings':
            setOpenedDialog('settings')
            break
          case 'general.undo':
            undoHistory()
            break
          case 'general.redo':
            redoHistory()
            break

          // editor
          case 'editor.translateMode':
            setMode('translate')
            break
          case 'editor.rotateMode':
            setMode('rotate')
            break
          case 'editor.scaleMode':
            setMode('scale')
            break
          case 'editor.duplicate':
            duplicateSelected()
            break
          case 'editor.groupOrUngroup':
            toggleGroup()
            break
          case 'editor.deleteEntity':
            deleteEntities(selectedEntityIds)
            break

          default:
            logger.warn('unknown shortcut action:', action)
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [shortcutReverseRecord])

  return null
}

export default ShortcutHandler
