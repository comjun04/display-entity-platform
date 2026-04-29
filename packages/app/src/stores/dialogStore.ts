import { merge } from 'lodash-es'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { getLogger } from '@/lib/logger'

// ==========
type DialogType =
  | 'welcome'
  | 'modal'
  | 'settings'
  | 'blockDisplaySelect'
  | 'itemDisplaySelect'
  | 'exportToMinecraft'
  | 'bakingPlayerHeads'
  | null
interface ModalData {
  title: string
  content: string
  buttonText: {
    positive: string
    negative: string
  }
}

type DialogState = {
  activeDialog: DialogType
  openDialog: (dialog: NonNullable<Exclude<DialogType, 'modal'>>) => void
  closeActiveDialog: () => void

  modalData: ModalData
  confirmModal: (data: ModalData) => Promise<boolean> // TODO: change fn name and args - this fn opens alert modal (e.g. confirmation) and waits for response, and resolves promise
  _setModalResponse: (choice: boolean) => void
}

const logger = getLogger('dialogStore')

let currentModalPromiseResolveFn:
  | PromiseWithResolvers<boolean>['resolve']
  | null = null

export const useDialogStore = create(
  immer<DialogState>((set, get) => ({
    activeDialog: null,
    openDialog: (dialog) =>
      set((state) => {
        state.activeDialog = dialog
      }),
    closeActiveDialog: () =>
      set((state) => {
        state.activeDialog = null
      }),

    modalData: {
      title: 'Sample Prompt Title',
      content: 'sample prompt content',
      buttonText: { positive: 'OK', negative: 'Cancel' },
    },
    confirmModal: (data) => {
      if (get().activeDialog === 'modal') {
        logger.error('Cannot open modal when another modal is open')
        return Promise.reject(
          new Error('Cannot open modal when another modal is open'),
        )
      }

      set((state) => {
        merge(state.modalData, data)
        state.activeDialog = 'modal'
      })

      const { promise, resolve } = Promise.withResolvers<boolean>()
      currentModalPromiseResolveFn = resolve

      return promise
    },
    _setModalResponse: (choice) => {
      currentModalPromiseResolveFn?.(choice)
      currentModalPromiseResolveFn = null

      set((state) => {
        // close modal
        state.activeDialog = null
      })
    },
  })),
)
