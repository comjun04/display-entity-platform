import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/shallow'

import { Field, FieldLabel } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { useEditorStore } from '@/stores/editorStore'

const PerformancePage: FC = () => {
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
        {t(($) => $.dialog.settings.page.performance.title)}
      </h3>

      <Field orientation="horizontal">
        <FieldLabel htmlFor="settings_performance_reducePixelRatio">
          {t(
            ($) => $.dialog.settings.page.performance.options.reducePixelRatio,
          )}
        </FieldLabel>
        <Switch
          id="settings_performance_reducePixelRatio"
          checked={settings.performance.reducePixelRatio}
          onCheckedChange={(checked) => {
            setSettings({
              performance: { reducePixelRatio: checked },
            })
          }}
        />
      </Field>
    </>
  )
}

export default PerformancePage
