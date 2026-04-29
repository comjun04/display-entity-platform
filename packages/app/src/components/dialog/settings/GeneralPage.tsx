import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/shallow'

import type { Settings } from '@/lib/settings'
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
      <h3 className="text-xl font-bold">
        {t(($) => $.dialog.settings.page.general.title)}
      </h3>

      <div className="mt-4 flex flex-row items-center gap-2">
        <label htmlFor="settings_general_language">
          {t(($) => $.dialog.settings.page.general.options.language)}
        </label>
        <select
          id="settings_general_language"
          className="flex-none rounded-sm bg-neutral-900 px-2 py-1"
          value={settings.general.language}
          onChange={(evt) => {
            setSettings({
              general: {
                language: evt.target.value as Settings['general']['language'],
              },
            })
          }}
        >
          <option value="en">English</option>
          <option value="ko">한국어</option>
        </select>
      </div>

      <div className="mt-4 flex flex-row items-center gap-2">
        <input
          type="checkbox"
          id="settings_general_showWelcomeOnStartup"
          checked={settings.general.showWelcomeOnStartup}
          onChange={(evt) => {
            setSettings({
              general: { showWelcomeOnStartup: evt.target.checked },
            })
          }}
        />
        <label htmlFor="settings_general_showWelcomeOnStartup">
          {t(
            ($) => $.dialog.settings.page.general.options.showWelcomeOnStartup,
          )}
        </label>
      </div>

      <div className="mt-4 flex flex-row items-center gap-2">
        <input
          type="checkbox"
          id="settings_general_forceUnifont"
          checked={settings.general.forceUnifont}
          onChange={(evt) => {
            setSettings({
              general: { forceUnifont: evt.target.checked },
            })
          }}
        />
        <label htmlFor="settings_general_forceUnifont">
          {t(($) => $.dialog.settings.page.general.options.forceUnifont)}
        </label>
      </div>
    </>
  )
}

export default GeneralPage
