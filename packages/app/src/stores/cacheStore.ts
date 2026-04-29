import { Mutex } from 'async-mutex'
import { MeshStandardMaterial, PlaneGeometry, Texture } from 'three'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

import { CDNBaseUrl } from '@/constants'
import { getLogger } from '@/lib/logger'
import { loadModel } from '@/lib/resources/model'
import type {
  AssetFileInfos,
  BlockstatesData,
  FontProvider,
  ModelData,
} from '@/types/base'

import { useProjectStore } from './projectStore'

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

export const useCacheStore = create(
  immer<CacheStoreState>((set) => ({
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

type FontGlyphData = {
  geometry: PlaneGeometry
  texture: Texture
  widthPixels: number
  baseWidthPixels: number
  heightPixels: number
  advance: number
  ascent: number
}
type ClassObjectCacheStoreState = {
  materials: Map<string, MeshStandardMaterial>
  setMaterial: (key: string, material: MeshStandardMaterial) => void

  fontGlyphs: Map<string, FontGlyphData>
  setFontGlyph: (key: string, data: FontGlyphData) => void
}

// DO NOT USE IMMER ON THIS STORE
export const useClassObjectCacheStore = create<ClassObjectCacheStoreState>(
  (set) => ({
    materials: new Map(),
    setMaterial: (key, material) =>
      set((state) => {
        const newMap = new Map(state.materials)
        newMap.set(key, material)
        return { materials: newMap }
      }),

    fontGlyphs: new Map(),
    setFontGlyph: (key, data) =>
      set((state) => {
        const newMap = new Map(state.fontGlyphs)
        newMap.set(key, data)
        return { fontGlyphs: newMap }
      }),
  }),
)

export class AssetFileInfosCache {
  private static _instance: AssetFileInfosCache

  private _cache = new Map<string, AssetFileInfos>()
  private _fetchMutexMap = new Map<string, Mutex>()

  private constructor() {}
  static get instance() {
    if (this._instance == null) {
      this._instance = new AssetFileInfosCache()
    }

    return this._instance
  }

  getInfos(version: string) {
    return this._cache.get(version)
  }

  async fetchAll(version?: string) {
    version ??= useProjectStore.getState().targetGameVersion

    if (!this._fetchMutexMap.has(version)) {
      this._fetchMutexMap.set(version, new Mutex())
    }
    const mutex = this._fetchMutexMap.get(version)!

    return await mutex.runExclusive(async () => {
      const existingData = this.getInfos(version)
      if (existingData != null) {
        return existingData
      }

      const data = (await fetch(`${CDNBaseUrl}/${version}/fileInfos.json`).then(
        (r) => r.json(),
      )) as AssetFileInfos
      logger.debug('[AssetFileInfosCache] set cache', version)
      this._cache.set(version, data)
      return data
    })
  }
  async fetchFileInfo(filePath: string, version?: string) {
    logger.debug('[AssetFileInfosCache] fetchFileInfo: ', filePath)
    const fileInfos = await this.fetchAll(version)

    const slashUnprefixedPath =
      filePath[0] === '/' ? filePath.slice(1) : filePath
    return fileInfos[slashUnprefixedPath] ?? null
  }

  async makeFullFileUrl(filePath: string, version?: string) {
    version ??= useProjectStore.getState().targetGameVersion
    const slashPrefixedFilePath =
      filePath[0] !== '/' ? `/${filePath}` : filePath

    const fileInfo = await this.fetchFileInfo(filePath, version)
    if (fileInfo == null) {
      throw new Error(
        `The file ${filePath} in version ${version} is unavailable`,
      )
    }

    return `${CDNBaseUrl}/${fileInfo.fromVersion}${slashPrefixedFilePath}`
  }

  clear() {
    this._cache.clear()
  }
}
