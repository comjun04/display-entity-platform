import { type FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaGithub } from 'react-icons/fa6'
import { LuArchiveRestore, LuFilePlus, LuFolderOpen } from 'react-icons/lu'
import { useShallow } from 'zustand/shallow'

import {
  Disclaimer,
  OpenSourceNotice,
  SpecialThanks,
  Title,
} from '@/components/brandings'
import { clearProject } from '@/lib/actions'
import { openFileFromUserSelect } from '@/lib/file-handler'
import AutosaveService from '@/lib/services/autosave.service'
import { useDialogStore } from '@/stores/dialogStore'
import { useEditorStore } from '@/stores/editorStore'

import Dialog from './Dialog'

const WelcomeDialog: FC = () => {
  const { t } = useTranslation()

  const { isOpen, closeActiveDialog } = useDialogStore(
    useShallow((state) => ({
      isOpen: state.activeDialog === 'welcome',
      closeActiveDialog: state.closeActiveDialog,
    })),
  )
  const { showWelcomeOnStartup, setSettings } = useEditorStore(
    useShallow((state) => ({
      showWelcomeOnStartup: state.settings.general.showWelcomeOnStartup,
      setSettings: state.setSettings,
    })),
  )

  const autosaveService = AutosaveService.instance

  const [showRecoverSessionSection, setShowRecoverSessionSection] = useState(
    autosaveService.saveExist,
  )

  const closeDialog = () => {
    setShowRecoverSessionSection(false)
    closeActiveDialog()
  }

  return (
    <Dialog title="" open={isOpen} onClose={closeDialog}>
      <div className="flex h-full flex-col gap-2 overflow-auto">
        <Title />
        <div className="h-full overflow-y-auto pt-4 pb-8">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              {/* v0.0.0 */}
              <div className="text-2xl text-sky-200">v{__VERSION__}</div>
              <div className="ml-4 text-sm text-neutral-400">
                <ul className="list-disc">
                  {t(($) => $.dialog.welcome.changeLogs, {
                    returnObjects: true,
                  }).map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <button
                className="flex flex-row items-center gap-2 rounded-sm bg-neutral-900 px-4 py-2"
                onClick={() => {
                  closeDialog()
                  clearProject().catch(console.error)
                }}
              >
                <LuFilePlus size={24} />
                <span>{t(($) => $.dialog.welcome.action.new)}</span>
              </button>
              <button
                className="flex flex-row items-center gap-2 rounded-sm bg-neutral-900 px-4 py-2"
                onClick={() => {
                  openFileFromUserSelect()
                  closeDialog()
                }}
              >
                <LuFolderOpen size={24} />
                <span>{t(($) => $.dialog.welcome.action.open)}</span>
              </button>
              {showRecoverSessionSection && (
                <div className="flex flex-col gap-2 rounded-sm bg-neutral-700 p-4">
                  <div>{t(($) => $.dialog.welcome.recoverProject.desc)}</div>

                  <button
                    className="flex flex-row items-center gap-2 rounded-sm bg-neutral-900 px-4 py-2"
                    onClick={() => {
                      closeDialog()
                      autosaveService.loadSave().catch(console.error)
                    }}
                  >
                    <LuArchiveRestore size={24} />
                    <span>
                      {t(($) => $.dialog.welcome.recoverProject.action.recover)}
                    </span>
                  </button>
                  <button
                    className="self-start text-start text-sm underline"
                    onClick={() => {
                      autosaveService.deleteSave()
                      setShowRecoverSessionSection(false)
                    }}
                  >
                    {t(($) => $.dialog.welcome.recoverProject.action.discard)}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-row items-center gap-2">
            <input
              type="checkbox"
              id="settings_showWelcomeOnStartup"
              checked={showWelcomeOnStartup}
              onChange={(evt) => {
                setSettings({
                  general: { showWelcomeOnStartup: evt.target.checked },
                })
              }}
            />
            <label htmlFor="settings_showWelcomeOnStartup">
              {t(($) => $.dialog.welcome.showWelcomeOnStartup)}
            </label>
          </div>
          <Disclaimer />
          <SpecialThanks />
          <OpenSourceNotice />
        </div>
      </div>
    </Dialog>
  )
}

export default WelcomeDialog
