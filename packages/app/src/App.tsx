import { QueryClientProvider } from '@tanstack/react-query'
import { type FC, useEffect } from 'react'
import {
  ErrorBoundary,
  type FallbackProps,
  getErrorMessage,
} from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { LuAmbulance, LuCircleX, LuDownload, LuRotateCcw } from 'react-icons/lu'

import ContextMenuHandler from './components/ContextMenuHandler'
import FileDropzone from './components/FileDropzone'
import LeftButtonPanel from './components/LeftButtonPanel'
import MobileBottomButtonPanel from './components/MobileBottomButtonPanel'
import QuickActionPanel from './components/QuickActionPanel'
import Scene from './components/Scene'
import Sidebar from './components/Sidebar'
import ToastContainer from './components/ToastContainer'
import ExportToMinecraftDialog from './components/dialog/ExportToMinecraftDialog'
import Modal from './components/dialog/Modal.tsx'
import PlayerHeadBakingDialog from './components/dialog/PlayerHeadBakingDialog'
import SettingsDialog from './components/dialog/SettingsDialog'
import WelcomeDialog from './components/dialog/WelcomeDialog'
import BlockDisplaySelectDialog from './components/dialog/display-selection/BlockDisplaySelectDialog.tsx'
import ItemDisplaySelectDialog from './components/dialog/display-selection/ItemDisplaySelectDialog.tsx'
import { Button } from './components/ui/button'
import { TooltipProvider } from './components/ui/tooltip'
import { queryClient } from './lib/query.ts'
import AutosaveService from './lib/services/autosave.service.ts'
import { downloadFile } from './lib/utils'
import { useDialogStore } from './stores/dialogStore'
import { useEditorStore } from './stores/editorStore'
import { useProjectStore } from './stores/projectStore.ts'

const BrowserTitleHandler: FC = () => {
  const projectName = useProjectStore((state) => state.projectName)
  const projectDirty = useEditorStore((state) => state.projectDirty)

  useEffect(() => {
    document.title = `${projectDirty ? '● ' : ''}${projectName} - Display Entity Platform`
  }, [projectName, projectDirty])

  return null
}

const CrashFallback: FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  const { t } = useTranslation()

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4 text-center">
      <LuCircleX size={128} />
      <p className="text-2xl">{t(($) => $.crashFallback.title)}</p>
      <pre className="max-h-[50dvh] overflow-auto text-wrap">
        {getErrorMessage(error)}
      </pre>
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        <Button size="lg" onClick={resetErrorBoundary}>
          <LuAmbulance /> {t(($) => $.crashFallback.tryRecover)}
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={() => window.location.reload()}
        >
          <LuRotateCcw /> {t(($) => $.crashFallback.reloadApp)}
        </Button>
      </div>

      <Button
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => {
          const saveDataBlob = AutosaveService.instance.getSave()
          if (saveDataBlob != null) {
            downloadFile(saveDataBlob, `depl-autosave-${Date.now()}.depl`)
          }
        }}
      >
        <LuDownload /> {t(($) => $.crashFallback.downloadAutosave)}
      </Button>
    </div>
  )
}

function App() {
  useEffect(() => {
    const { showWelcomeOnStartup } = useEditorStore.getState().settings.general
    if (showWelcomeOnStartup) {
      useDialogStore.getState().openDialog('welcome')
    }
  }, [])

  useEffect(() => {
    const listener = (evt: BeforeUnloadEvent) => {
      const { projectDirty } = useEditorStore.getState()
      if (projectDirty) {
        AutosaveService.instance.forceSave().catch(console.error)
        evt.preventDefault()
        evt.returnValue = 'string' // legacy method to trigger confirmation dialog
      }
    }

    window.addEventListener('beforeunload', listener)
    return () => {
      window.removeEventListener('beforeunload', listener)
    }
  }, [])

  return (
    <ErrorBoundary fallbackRender={(props) => <CrashFallback {...props} />}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delay={300}>
          <div className="relative flex h-full w-full overflow-hidden">
            <div className="relative h-full flex-1 overflow-hidden">
              {/* overflow-hidden is required to prevent child canvas width height from affecting parent div
              and correctly measure parent container size for canvas resizing */}
              <ContextMenuHandler triggerClassName="h-full w-full">
                <Scene />
              </ContextMenuHandler>

              {/* floating buttons */}
              <LeftButtonPanel />
              <QuickActionPanel />
              <MobileBottomButtonPanel />
            </div>

            <Sidebar />

            <WelcomeDialog />
            <Modal />
            <SettingsDialog />
            <BlockDisplaySelectDialog />
            <ItemDisplaySelectDialog />
            <ExportToMinecraftDialog />
            <PlayerHeadBakingDialog />

            <FileDropzone />
          </div>

          <BrowserTitleHandler />

          <ToastContainer />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
