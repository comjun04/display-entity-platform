import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useShallow } from 'zustand/shallow'

import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { exportSettings, importSettings } from '@/lib/settings/actions'
import { type Settings } from '@/lib/settings/prelude'
import { useEditorStore } from '@/stores/editorStore'

const GeneralPage: FC = () => {
  const { t } = useTranslation()

  const { settings, setSettings } = useEditorStore(
    useShallow((state) => ({
      settings: state.settings,
      setSettings: state.setSettings,
    })),
  )

  return (
    <>
      <h3 className="mb-4 text-xl font-bold">
        {t(($) => $.dialog.settings.page.general.title)}
      </h3>

      <FieldGroup>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="settings_general_language">
            {t(($) => $.dialog.settings.page.general.options.language)}
          </FieldLabel>
          <NativeSelect
            id="settings_general_language"
            value={settings.general.language}
            onChange={(evt) => {
              setSettings({
                general: {
                  language: evt.target.value as Settings['general']['language'],
                },
              })
            }}
          >
            <NativeSelectOption value="en">English</NativeSelectOption>
            <NativeSelectOption value="ko">한국어</NativeSelectOption>
          </NativeSelect>
        </Field>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="settings_general_showWelcomeOnStartup">
            {t(
              ($) =>
                $.dialog.settings.page.general.options.showWelcomeOnStartup,
            )}
          </FieldLabel>
          <Switch
            id="settings_general_showWelcomeOnStartup"
            checked={settings.general.showWelcomeOnStartup}
            onCheckedChange={(checked) => {
              setSettings({
                general: { showWelcomeOnStartup: checked },
              })
            }}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="settings_general_forceUnifont">
            {t(($) => $.dialog.settings.page.general.options.forceUnifont)}
          </FieldLabel>
          <Switch
            id="settings_general_forceUnifont"
            checked={settings.general.forceUnifont}
            onCheckedChange={(checked) => {
              setSettings({
                general: { forceUnifont: checked },
              })
            }}
          />
        </Field>

        <div className="flex gap-2">
          <Button
            onClick={() => {
              const inputElement = document.createElement('input')
              inputElement.type = 'file'
              inputElement.accept = 'application/json'
              inputElement.click()
              inputElement.onchange = (evt) => {
                const file = (evt.target as HTMLInputElement).files?.[0]
                if (file == null) return

                file
                  .text()
                  .then((text) => {
                    importSettings(text)
                    toast.success('Successfully imported settings from file')
                  })
                  .catch(console.error)
              }
            }}
          >
            Import Settings from file
          </Button>
          <Button
            onClick={() => {
              exportSettings()
              toast.success('Successfully exported settings to file')
            }}
          >
            Export Settings to file
          </Button>
        </div>
      </FieldGroup>
    </>
  )
}

export default GeneralPage
