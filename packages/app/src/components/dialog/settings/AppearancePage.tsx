import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/shallow'

import type { Settings } from '@/lib/settings'
import { useEditorStore } from '@/stores/editorStore'

const AppearancePage: FC = () => {
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
        {t(($) => $.dialog.settings.page.appearance.title)}
      </h3>

      <div className="mt-4 flex flex-col gap-2">
        <div className="text-lg font-semibold">
          {t(
            ($) =>
              $.dialog.settings.page.appearance.sections.quickActionPanel.title,
          )}
        </div>
        <div className="flex flex-row gap-4">
          <div className="flex flex-row items-center gap-2">
            <label htmlFor="settings_appearance_quickActionPanel_location">
              {t(
                ($) =>
                  $.dialog.settings.page.appearance.sections.quickActionPanel
                    .options.location.title,
              )}
            </label>
            <select
              id="settings_appearance_quickActionPanel_location"
              className="flex-none rounded-sm bg-neutral-900 px-2 py-1"
              value={settings.appearance.quickActionPanel.location}
              onChange={(evt) => {
                setSettings({
                  appearance: {
                    quickActionPanel: {
                      location: evt.target
                        .value as Settings['appearance']['quickActionPanel']['location'],
                    },
                  },
                })
              }}
            >
              <option value="top">
                {t(
                  ($) =>
                    $.dialog.settings.page.appearance.sections.quickActionPanel
                      .options.location.values.top,
                )}
              </option>
              <option value="bottom">
                {t(
                  ($) =>
                    $.dialog.settings.page.appearance.sections.quickActionPanel
                      .options.location.values.bottom,
                )}
              </option>
            </select>
          </div>

          <div className="flex flex-row items-center gap-2">
            <label htmlFor="settings_appearance_quickActionPanel_margin">
              {t(
                ($) =>
                  $.dialog.settings.page.appearance.sections.quickActionPanel
                    .options.margin.title,
              )}
            </label>
            <input
              type="number"
              className="w-16 shrink rounded-sm bg-neutral-900 py-2 pl-2 text-xs outline-hidden"
              value={settings.appearance.quickActionPanel.margin}
              onChange={(evt) => {
                const newMargin = parseInt(evt.target.value)
                if (!isFinite(newMargin)) return
                setSettings({
                  appearance: {
                    quickActionPanel: {
                      margin: newMargin,
                    },
                  },
                })
              }}
            />
          </div>
        </div>

        <div className="mt-4 text-lg font-semibold">
          {t(($) => $.dialog.settings.page.appearance.sections.gizmo.title)}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
          <div className="flex flex-row items-center gap-2">
            <label htmlFor="settings_appearance_gizmo_location">
              {t(
                ($) =>
                  $.dialog.settings.page.appearance.sections.quickActionPanel
                    .options.location.title,
              )}
            </label>
            <select
              id="settings_appearance_gizmo_location"
              className="flex-none rounded-sm bg-neutral-900 px-2 py-1"
              value={settings.appearance.gizmo.location}
              onChange={(evt) => {
                setSettings({
                  appearance: {
                    gizmo: {
                      location: evt.target
                        .value as Settings['appearance']['gizmo']['location'],
                    },
                  },
                })
              }}
            >
              <option value="bottom-left">bottom-left</option>
              <option value="bottom-right">bottom-right</option>
            </select>
          </div>

          <div className="flex flex-row items-center gap-2">
            <span>
              {t(
                ($) =>
                  $.dialog.settings.page.appearance.sections.gizmo.options
                    .margin.title,
              )}
            </span>

            {/* margin width */}
            <label htmlFor="settings_appearance_gizmo_marginWidth">
              {t(
                ($) =>
                  $.dialog.settings.page.appearance.sections.gizmo.options
                    .margin.subOptions.width,
              )}
            </label>
            <input
              type="number"
              id="settings_appearance_gizmo_marginHeight"
              className="w-16 shrink rounded-sm bg-neutral-900 py-2 pl-2 text-xs outline-hidden"
              value={settings.appearance.gizmo.marginWidth}
              onChange={(evt) => {
                const newMargin = parseInt(evt.target.value)
                if (!isFinite(newMargin)) return
                setSettings({
                  appearance: {
                    gizmo: {
                      marginWidth: newMargin,
                    },
                  },
                })
              }}
            />

            {/* margin height */}
            <label htmlFor="settings_appearance_gizmo_marginHeight">
              {t(
                ($) =>
                  $.dialog.settings.page.appearance.sections.gizmo.options
                    .margin.subOptions.height,
              )}
            </label>
            <input
              type="number"
              id="settings_appearance_gizmo_marginWidth"
              className="w-16 shrink rounded-sm bg-neutral-900 py-2 pl-2 text-xs outline-hidden"
              value={settings.appearance.gizmo.marginHeight}
              onChange={(evt) => {
                const newMargin = parseInt(evt.target.value)
                if (!isFinite(newMargin)) return
                setSettings({
                  appearance: {
                    gizmo: {
                      marginHeight: newMargin,
                    },
                  },
                })
              }}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default AppearancePage
