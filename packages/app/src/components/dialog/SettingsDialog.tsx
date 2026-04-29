import { type FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/shallow'

import { cn } from '@/lib/utils'
import { useDialogStore } from '@/stores/dialogStore'

import Dialog from './Dialog'
import AboutPage from './settings/AboutPage'
import AppearancePage from './settings/AppearancePage'
import DebugOptionsPage from './settings/DebugOptionsPage'
import GeneralPage from './settings/GeneralPage'
import HeadPainterPage from './settings/HeadPainterPage'
import PerformancePage from './settings/PerformancePage'
import ShortcutsPage from './settings/ShortcutsPage'

type SettingsPageType =
  | 'general'
  | 'appearance'
  | 'performance'
  | 'shortcuts'
  | 'headPainter'
  | 'about'
  | 'debug'

const SettingsDialog: FC = () => {
  const { t } = useTranslation()

  const { isOpen, closeActiveDialog } = useDialogStore(
    useShallow((state) => ({
      isOpen: state.activeDialog === 'settings',
      closeActiveDialog: state.closeActiveDialog,
    })),
  )

  const [selectedPage, setSelectedPage] = useState<SettingsPageType>('general')

  return (
    <Dialog
      title={t(($) => $.dialog.settings.title)}
      open={isOpen}
      onClose={closeActiveDialog}
      className={cn(selectedPage === 'appearance' && 'bg-background/60')}
      backdropClassName={cn(
        selectedPage === 'appearance' && 'sm:backdrop-blur-none',
      )}
    >
      <div className="flex h-full w-full flex-col overflow-auto sm:flex-row">
        {/* Desktop - left side settings submenu list */}
        <div className="hidden w-[30%] border-r-2 border-neutral-700 px-4 sm:block">
          <div className="flex flex-col gap-1">
            <button
              className={cn(
                'w-full rounded-sm px-2 py-1 text-start text-sm transition duration-150',
                selectedPage === 'general'
                  ? 'bg-neutral-700'
                  : 'hover:bg-neutral-700/50',
              )}
              onClick={() => setSelectedPage('general')}
            >
              {t(($) => $.dialog.settings.page.general.title)}
            </button>

            <button
              className={cn(
                'w-full rounded-sm px-2 py-1 text-start text-sm transition duration-150',
                selectedPage === 'appearance'
                  ? 'bg-neutral-700'
                  : 'hover:bg-neutral-700/50',
              )}
              onClick={() => setSelectedPage('appearance')}
            >
              {t(($) => $.dialog.settings.page.appearance.title)}
            </button>

            <button
              className={cn(
                'w-full rounded-sm px-2 py-1 text-start text-sm transition duration-150',
                selectedPage === 'performance'
                  ? 'bg-neutral-700'
                  : 'hover:bg-neutral-700/50',
              )}
              onClick={() => setSelectedPage('performance')}
            >
              {t(($) => $.dialog.settings.page.performance.title)}
            </button>
            <button
              className={cn(
                'w-full rounded-sm px-2 py-1 text-start text-sm transition duration-150',
                selectedPage === 'shortcuts'
                  ? 'bg-neutral-700'
                  : 'hover:bg-neutral-700/50',
              )}
              onClick={() => setSelectedPage('shortcuts')}
            >
              {t(($) => $.dialog.settings.page.shortcuts.title)}
            </button>
            <button
              className={cn(
                'w-full rounded-sm px-2 py-1 text-start text-sm transition duration-150',
                selectedPage === 'headPainter'
                  ? 'bg-neutral-700'
                  : 'hover:bg-neutral-700/50',
              )}
              onClick={() => setSelectedPage('headPainter')}
            >
              {t(($) => $.dialog.settings.page.headPainter.title)}
            </button>

            <hr className="border-t-2 border-neutral-700" />

            <button
              className={cn(
                'w-full rounded-sm px-2 py-1 text-start text-sm transition duration-150',
                selectedPage === 'about'
                  ? 'bg-neutral-700'
                  : 'hover:bg-neutral-700/50',
              )}
              onClick={() => setSelectedPage('about')}
            >
              {t(($) => $.dialog.settings.page.about.title)}
            </button>
            <button
              className={cn(
                'w-full rounded-sm px-2 py-1 text-start text-sm transition duration-150',
                selectedPage === 'debug'
                  ? 'bg-neutral-700'
                  : 'hover:bg-neutral-700/50',
              )}
              onClick={() => setSelectedPage('debug')}
            >
              {t(($) => $.dialog.settings.page.debugOptions.title)}
            </button>
          </div>
        </div>
        {/* Mobile - submenu <select> element on top */}
        <div className="sm:hidden">
          <select
            className="w-full rounded-sm bg-neutral-900 p-2"
            value={selectedPage}
            onChange={(evt) =>
              setSelectedPage(evt.target.value as SettingsPageType)
            }
          >
            <option value="general">
              {t(($) => $.dialog.settings.page.general.title)}
            </option>
            <option value="appearance">
              {t(($) => $.dialog.settings.page.appearance.title)}
            </option>
            <option value="performance">
              {t(($) => $.dialog.settings.page.performance.title)}
            </option>
            <option value="shortcuts">
              {t(($) => $.dialog.settings.page.shortcuts.title)}
            </option>
            <option value="headPainter">
              {t(($) => $.dialog.settings.page.headPainter.title)}
            </option>
            <option disabled>----------</option>
            <option value="about">
              {t(($) => $.dialog.settings.page.about.title)}
            </option>
            <option value="debug">
              {t(($) => $.dialog.settings.page.debugOptions.title)}
            </option>
          </select>
        </div>

        <div className="h-full w-full overflow-auto pt-4 sm:px-4 sm:pt-0">
          {/* General */}
          {selectedPage === 'general' && <GeneralPage />}

          {/* Appearance */}
          {selectedPage === 'appearance' && <AppearancePage />}

          {/* Performance */}
          {selectedPage === 'performance' && <PerformancePage />}

          {/* Shortcuts */}
          {selectedPage === 'shortcuts' && <ShortcutsPage />}

          {/* Head Painter */}
          {selectedPage === 'headPainter' && <HeadPainterPage />}

          {/* About */}
          {selectedPage === 'about' && <AboutPage />}

          {/* Debug */}
          {selectedPage === 'debug' && <DebugOptionsPage />}
        </div>
      </div>
    </Dialog>
  )
}

export default SettingsDialog
