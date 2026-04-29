import { type FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuEye, LuEyeClosed } from 'react-icons/lu'
import { toast } from 'sonner'
import { useShallow } from 'zustand/shallow'

import { useEditorStore } from '@/stores/editorStore'

const HeadPainterPage: FC = () => {
  const { t } = useTranslation()

  const { settings, setSettings } = useEditorStore(
    useShallow((state) => ({
      settings: state.settings,
      setSettings: state.setSettings,
    })),
  )
  const { mineskinApiKey } = settings.headPainter

  const [tempApiKeyInput, setTempApiKeyInput] = useState(
    settings.headPainter.mineskinApiKey,
  )
  const [hideApiKeyInputValue, setHideApiKeyInputValue] = useState(true)

  useEffect(() => {
    setTempApiKeyInput(mineskinApiKey)
  }, [mineskinApiKey])

  return (
    <>
      <h3 className="text-xl font-bold">
        {t(($) => $.dialog.settings.page.headPainter.title)}
      </h3>
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex flex-row items-center gap-2">
          <label
            htmlFor="settings_headPainter_mineskinApiKey"
            className="flex-none"
          >
            {t(
              ($) =>
                $.dialog.settings.page.headPainter.options.mineskinApiKey.title,
            )}
          </label>
          <div className="flex flex-row items-center gap-2 rounded-sm bg-neutral-700 p-1">
            <input
              type={hideApiKeyInputValue ? 'password' : 'text'}
              id="settings_headPainter_mineskinApiKey"
              className="w-full bg-transparent"
              value={tempApiKeyInput}
              onChange={(evt) => {
                setTempApiKeyInput(evt.target.value)
              }}
            />
            <button
              onClick={() => {
                setHideApiKeyInputValue((prev) => !prev)
              }}
            >
              {hideApiKeyInputValue ? <LuEyeClosed /> : <LuEye />}
            </button>
          </div>
        </div>
        <div className="flex flex-row gap-2">
          <button
            className="rounded-sm bg-blue-500 px-3 py-1"
            onClick={() => {
              setSettings({
                headPainter: { mineskinApiKey: tempApiKeyInput },
              })
              toast.success(
                t(
                  ($) =>
                    $.dialog.settings.page.headPainter.options.mineskinApiKey
                      .toasts.saveSuccess,
                ),
              )
            }}
          >
            {t(
              ($) =>
                $.dialog.settings.page.headPainter.options.mineskinApiKey
                  .buttons.save,
            )}
          </button>
        </div>
      </div>
    </>
  )
}

export default HeadPainterPage
