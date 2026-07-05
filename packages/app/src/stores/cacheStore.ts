import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { getLogger } from '@/lib/logger'
import { AssetFileInfosCache } from '@/lib/resources/assetFileInfo'
import { loadModel } from '@/lib/resources/model'
import type { BlockstatesData, FontProvider, ModelData } from '@/types/base'

const logger = getLogger('cacheStore')

// ==========

type CacheStoreState = {
  blockstatesData: Record<string, BlockstatesData>
  setBlockstateData: (blockType: string, data: BlockstatesData) => void

  modelData: Record<
    string,
    {
      data: ModelData
      isBlockShapedItemModel: boolean
    }
  >
  modelDataLoading: Set<string>
  loadModelData: (resourceLocation: string) => Promise<void>
  setModelData: (
    resourceLocation: string,
    data: ModelData,
    isBlockShapedItemModel: boolean,
  ) => void

  croppedTextureDataUrls: Record<string, string>
  setCroppedTextureDataUrl: (
    resourceLocation: string,
    imageDataUrl: string,
  ) => void

  // 폰트 데이터 캐시 (.png, unifont)
  fontResources: Record<string, string> // png는 data url로 저장함
  setFontResource: (key: string, data: string) => void

  fontProviders: Record<string, FontProvider[]>
  setFontProviders: (key: string, data: FontProvider[]) => void
}

// 캐시 저장소

export const useCacheStore = create<CacheStoreState>()(
  immer((set) => ({
    blockstatesData: {},
    setBlockstateData: (blockType, blockstatesData) =>
      set((state) => {
        state.blockstatesData[blockType] = blockstatesData
      }),

    modelData: {},
    modelDataLoading: new Set(),
    loadModelData: async (resourceLocation) => {
      const fileInfo = await AssetFileInfosCache.instance.fetchFileInfo(
        `/assets/minecraft/models/${resourceLocation}.json`,
      )
      if (fileInfo == null) {
        set((state) => state.modelDataLoading.delete(resourceLocation))
        throw new Error(`Cannot get info of model file ${resourceLocation}`)
      }

      const key = `${fileInfo.fromVersion};${resourceLocation}`
      logger.debug('loadModelData:', key)

      set((state) => {
        if (state.modelDataLoading.has(resourceLocation)) return
        state.modelDataLoading = new Set(state.modelDataLoading)
        state.modelDataLoading.add(resourceLocation)
      })

      const modelData = await loadModel(resourceLocation)
      set((state) => {
        state.modelData[key] = modelData

        state.modelDataLoading = new Set(state.modelDataLoading)
        state.modelDataLoading.delete(resourceLocation)
      })
    },
    setModelData: (resourceLocation, data, isBlockShapedItemModel) =>
      set((state) => {
        const modelData = state.modelData[resourceLocation]

        if (modelData == null) {
          state.modelData[resourceLocation] = { data, isBlockShapedItemModel }
        }
      }),

    croppedTextureDataUrls: {},
    setCroppedTextureDataUrl: (resourceLocation, imageDataUrl) =>
      set((state) => {
        state.croppedTextureDataUrls[resourceLocation] = imageDataUrl
      }),

    fontResources: {},
    setFontResource: (key, data) =>
      set((state) => {
        state.fontResources[key] = data
      }),

    fontProviders: {},
    setFontProviders: (key, data) =>
      set((state) => {
        state.fontProviders[key] = data
      }),
  })),
)
