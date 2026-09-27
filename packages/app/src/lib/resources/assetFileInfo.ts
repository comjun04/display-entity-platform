import type { AssetFileInfos } from '@depl/shared'
import { Mutex } from 'async-mutex'

import { CDNBaseUrl } from '@/constants'
import { useProjectStore } from '@/stores/projectStore'

import { getLogger } from '../logger'

const logger = getLogger('assetFileInfo')

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
