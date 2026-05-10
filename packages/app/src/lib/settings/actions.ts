import { useEditorStore } from '@/stores/editorStore'

import { downloadFile } from '../utils'
import { settingsSchema } from './prelude'

export function importSettings(rawSettingsJson: string) {
  const obj = JSON.parse(rawSettingsJson) as unknown
  const parsedSettings = settingsSchema.parse(obj)

  useEditorStore.getState().setSettings(parsedSettings)
}

export function exportSettings() {
  const { settings } = useEditorStore.getState()
  const settingsJson = JSON.stringify(settings, null, 2)

  downloadFile(new Blob([settingsJson]), 'depl_settings.json')
}
