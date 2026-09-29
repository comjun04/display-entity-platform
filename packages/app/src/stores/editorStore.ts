import { merge } from 'es-toolkit'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import i18n from '@/lib/i18n/config'
import { getLogger } from '@/lib/logger'
import { type Settings, getStoredSettings } from '@/lib/settings/prelude'
import type {
  DeepPartial,
  DisplayEntity,
  Number3Tuple,
  PartialNumber3Tuple,
} from '@/types/base'

const logger = getLogger('editorStore')

// ==========

type EditorMode = 'translate' | 'rotate' | 'scale'
type RotationSpace = 'world' | 'local'
type TransformationData = {
  position: Number3Tuple
  rotation: Number3Tuple
  size: Number3Tuple
}

export type HeadPainterLayer = 'base' | 'second'

type EditorState = {
  mode: EditorMode
  setMode: (newMode: EditorMode) => void

  rotationSpace: RotationSpace
  setRotationSpace: (space: RotationSpace) => void

  mobileSidebarOpened: boolean
  setMobileSidebarOpened: (opened: boolean) => void

  mobileDragHoldButtonPressed: boolean
  setMobileDragHoldButtonPressed: (pressed: boolean) => void

  usingTransformControl: boolean
  setUsingTransformControl: (value: boolean) => void

  /**
   * 선택된 display entity transformation 실시간 업데이트용
   */
  selectionBaseTransformation: TransformationData
  setSelectionBaseTransformation: (data: {
    position?: PartialNumber3Tuple
    rotation?: PartialNumber3Tuple
    size?: PartialNumber3Tuple
  }) => void

  transformControl: {
    needsSelectedEntitiesTransformationUpdate: boolean
    setSelectedEntitiesTransformationUpdateFlag: (value: boolean) => void
  }

  projectDirty: boolean
  setProjectDirty: (isDirty: boolean) => void

  headPainter: {
    enabled: boolean
    setEnabled: (enabled: boolean) => void

    nowPainting: boolean
    setNowPainting: (painting: boolean) => void

    brushColor: number
    setBrushColor: (color: number) => void

    layer: HeadPainterLayer
    setLayer: (layer: HeadPainterLayer) => void
  }

  settings: Settings
  setSettings: (newSettings: DeepPartial<Settings>) => void

  clipboard: {
    data: DisplayEntity[]
    setData: (entities: DisplayEntity[]) => void
  }

  resetProject: () => void
}

export const useEditorStore = create<EditorState>()(
  immer((set) => {
    const initialSettings = getStoredSettings()
    globalThis.__depl_alertUncaughtError =
      initialSettings?.debug?.alertUncaughtError

    return {
      mode: 'translate',
      setMode: (newMode) =>
        set((state) => {
          state.mode = newMode
        }),

      rotationSpace: 'world',
      setRotationSpace: (space) =>
        set((state) => {
          state.rotationSpace = space
        }),

      mobileSidebarOpened: false,
      setMobileSidebarOpened: (opened) =>
        set((state) => {
          state.mobileSidebarOpened = opened
        }),

      mobileDragHoldButtonPressed: false,
      setMobileDragHoldButtonPressed: (pressed) =>
        set((state) => {
          state.mobileDragHoldButtonPressed = pressed
        }),

      usingTransformControl: false,
      setUsingTransformControl: (value) =>
        set((state) => {
          state.usingTransformControl = value
        }),

      selectionBaseTransformation: {
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        size: [1, 1, 1],
      },
      setSelectionBaseTransformation: (data) =>
        set((state) => {
          if (data?.position != null) {
            const positionDraft =
              state.selectionBaseTransformation.position.slice() as Number3Tuple
            data.position.forEach((d, idx) => {
              if (d != null) {
                positionDraft[idx] = d
              }
            })
            state.selectionBaseTransformation.position = positionDraft
          }
          if (data?.rotation != null) {
            const rotationDraft =
              state.selectionBaseTransformation.rotation.slice() as Number3Tuple
            data.rotation.forEach((d, idx) => {
              if (d != null) {
                rotationDraft[idx] = d
              }
            })
            state.selectionBaseTransformation.rotation = rotationDraft
          }
          if (data?.size != null) {
            const scaleDraft =
              state.selectionBaseTransformation.size.slice() as Number3Tuple
            data.size.forEach((d, idx) => {
              if (d != null) {
                scaleDraft[idx] = d
              }
            })
            state.selectionBaseTransformation.size = scaleDraft
          }
        }),

      transformControl: {
        // This flag is used by TransformControls to refetch entities' initial transformation on changes outside of TransformControls
        // acting as a global store-based signaling.
        needsSelectedEntitiesTransformationUpdate: false,
        setSelectedEntitiesTransformationUpdateFlag: (value) =>
          set((state) => {
            state.transformControl.needsSelectedEntitiesTransformationUpdate =
              value
          }),
      },

      projectDirty: false,
      setProjectDirty: (isDirty) =>
        set((state) => {
          state.projectDirty = isDirty
        }),

      headPainter: {
        enabled: false,
        setEnabled: (enabled) =>
          set((state) => {
            state.headPainter.enabled = enabled
          }),

        nowPainting: false,
        setNowPainting: (painting) =>
          set((state) => {
            state.headPainter.nowPainting = painting
          }),

        brushColor: 0xffffff,
        setBrushColor: (color) =>
          set((state) => {
            state.headPainter.brushColor = color
          }),

        layer: 'base',
        setLayer: (layer) =>
          set((state) => {
            state.headPainter.layer = layer
          }),
      },

      settings: initialSettings,
      setSettings: (newSettings) =>
        set((state) => {
          merge(state.settings, newSettings)

          if (newSettings?.debug?.alertUncaughtError != null) {
            globalThis.__depl_alertUncaughtError =
              newSettings.debug.alertUncaughtError
          }

          if (newSettings.general?.language != null) {
            i18n
              .changeLanguage(newSettings.general.language)
              .catch(console.error)
          }

          try {
            window.localStorage.setItem(
              'settings',
              JSON.stringify(state.settings),
            )
          } catch (err) {
            logger.error(err)
          }
        }),

      clipboard: {
        data: [],
        setData: (entities) =>
          set((state) => {
            state.clipboard.data = entities
            console.log(entities)
          }),
      },

      resetProject: () =>
        set((state) => {
          state.selectionBaseTransformation = {
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            size: [1, 1, 1],
          }
          state.usingTransformControl = false
          state.projectDirty = false
        }),
    }
  }),
)
