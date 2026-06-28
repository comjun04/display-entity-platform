import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { LatestGameVersion } from '@/constants'

interface ProjectStoreState {
  targetGameVersion: string
  setTargetGameVersion: (version: string) => void

  projectName: string
  setProjectName: (name: string) => void

  mainNBT: string
  setMainNBT: (nbt: string) => void
}

export const useProjectStore = create(
  immer<ProjectStoreState>((set) => ({
    targetGameVersion: LatestGameVersion,
    setTargetGameVersion: (version) => {
      set((state) => {
        state.targetGameVersion = version
      })
    },

    projectName: 'Untitled',
    setProjectName: (name) =>
      set((state) => {
        state.projectName = name
      }),

    mainNBT: '',
    setMainNBT: (nbt) =>
      set((state) => {
        state.mainNBT = nbt
      }),
  })),
)
