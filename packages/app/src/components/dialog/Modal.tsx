import type { FC } from 'react'
import { useShallow } from 'zustand/shallow'

import { useDialogStore } from '@/stores/dialogStore'

import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
} from '../ui/alert-dialog'
import Dialog from './Dialog'

const PromptDialog: FC = () => {
  const { isOpen, modalData, setModalResponse } = useDialogStore(
    useShallow((state) => ({
      isOpen: state.activeDialog === 'modal',
      modalData: state.modalData,
      setModalResponse: state._setModalResponse,
    })),
  )

  const closeDialog = () => {
    setModalResponse(false)
  }

  return (
    <Dialog
      title={modalData.title}
      open={isOpen}
      onClose={closeDialog}
      useLargeStaticSize={false}
      modal
    >
      <AlertDialogDescription>{modalData.content}</AlertDialogDescription>
      <AlertDialogFooter>
        <div className="flex flex-row-reverse gap-2">
          <AlertDialogAction
            onClick={() => {
              setModalResponse(true)
            }}
          >
            {modalData.buttonText.positive}
          </AlertDialogAction>
          <AlertDialogCancel onClick={closeDialog}>
            {modalData.buttonText.negative}
          </AlertDialogCancel>
        </div>
      </AlertDialogFooter>
    </Dialog>
  )
}

export default PromptDialog
