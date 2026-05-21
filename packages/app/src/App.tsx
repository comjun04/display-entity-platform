import { QueryClientProvider } from '@tanstack/react-query'
import { type FC, useEffect } from 'react'

import ContextMenuHandler from './components/ContextMenuHandler'
import FileDropzone from './components/FileDropzone'
import LeftButtonPanel from './components/LeftButtonPanel'
import MobileBottomButtonPanel from './components/MobileBottomButtonPanel'
import QuickActionPanel from './components/QuickActionPanel'
import Scene from './components/Scene'
import Sidebar from './components/Sidebar'
import ToastContainer from './components/ToastContainer'
import BlockDisplaySelectDialog from './components/dialog/BlockDisplaySelectDialog'
import ExportToMinecraftDialog from './components/dialog/ExportToMinecraftDialog'
import ItemDisplaySelectDialog from './components/dialog/ItemDisplaySelectDialog'
import Modal from './components/dialog/Modal.tsx'
import PlayerHeadBakingDialog from './components/dialog/PlayerHeadBakingDialog'
import SettingsDialog from './components/dialog/SettingsDialog'
import WelcomeDialog from './components/dialog/WelcomeDialog'
import { TooltipProvider } from './components/ui/tooltip'
import { queryClient } from './lib/query.ts'
import AutosaveService from './lib/services/autosave.service.ts'
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
  )
}

export default App
