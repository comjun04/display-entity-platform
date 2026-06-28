import { reloadResources } from 'i18next'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useShallow } from 'zustand/shallow'

import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { useEditorStore } from '@/stores/editorStore'
import type { LogLevel } from '@/types/base'

const DebugOptionsPage: FC = () => {
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
        {t(($) => $.dialog.settings.page.debugOptions.title)}
      </h3>

      <FieldGroup>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="settings_debug_minloglevel">
              {t(
                ($) =>
                  $.dialog.settings.page.debugOptions.options.minLogLevel.title,
              )}
            </FieldLabel>
            <NativeSelect
              id="settings_debug_minloglevel"
              value={settings.debug.minLogLevel}
              onChange={(evt) => {
                setSettings({
                  debug: { minLogLevel: evt.target.value as LogLevel },
                })
              }}
            >
              <NativeSelectOption>error</NativeSelectOption>
              <NativeSelectOption>warn</NativeSelectOption>
              <NativeSelectOption>info</NativeSelectOption>
              <NativeSelectOption>debug</NativeSelectOption>
            </NativeSelect>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="settings_debug_perfMonitorEnabled">
              {t(
                ($) =>
                  $.dialog.settings.page.debugOptions.options.perfMonitorEnabled
                    .title,
              )}
            </FieldLabel>
            <Switch
              id="settings_debug_perfMonitorEnabled"
              checked={settings.debug.perfMonitorEnabled}
              onCheckedChange={(checked) => {
                setSettings({
                  debug: { perfMonitorEnabled: checked },
                })
              }}
            />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="settings_debug_alertUncaughtError">
              {t(
                ($) =>
                  $.dialog.settings.page.debugOptions.options.alertUncaughtError
                    .title,
              )}
            </FieldLabel>
            <Switch
              id="settings_debug_alertUncaughtError"
              checked={settings.debug.alertUncaughtError}
              onCheckedChange={(checked) => {
                setSettings({
                  debug: { alertUncaughtError: checked },
                })
              }}
            />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="settings_debug_showPivotIndicator">
              {t(
                ($) =>
                  $.dialog.settings.page.debugOptions.options.showPivotIndicator
                    .title,
              )}
            </FieldLabel>
            <Switch
              id="settings_debug_showPivotIndicator"
              checked={settings.debug.showPivotIndicator}
              onCheckedChange={(checked) => {
                setSettings({
                  debug: { showPivotIndicator: checked },
                })
              }}
            />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="settings_debug_showEntityIdOnObjectPanel">
              {t(
                ($) =>
                  $.dialog.settings.page.debugOptions.options
                    .showEntityIdOnObjectPanel.title,
              )}
            </FieldLabel>
            <Switch
              id="settings_debug_showEntityIdOnObjectPanel"
              checked={settings.debug.showEntityIdOnObjectPanel}
              onCheckedChange={(checked) => {
                setSettings({
                  debug: { showEntityIdOnObjectPanel: checked },
                })
              }}
            />
          </Field>
        </FieldGroup>

        <div className="flex gap-2">
          <Button onClick={() => toast.info('This is a test toast')}>
            Show Toast
          </Button>
          <Button
            onClick={() => {
              reloadResources()
                .then(() => toast.success('Reloaded translations'))
                .catch(console.error)
            }}
          >
            Reload translations
          </Button>
        </div>
      </FieldGroup>
    </>
  )
}

export default DebugOptionsPage
