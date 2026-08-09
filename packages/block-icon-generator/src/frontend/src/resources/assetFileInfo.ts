import type { AssetFileInfos } from '@depl/shared'
import { Mutex } from 'async-mutex'

import { CDNBaseUrl } from '../constants'

export class AssetFileInfosCache {
  private static _instance: AssetFileInfosCache

  private _cache = new Map<string, AssetFileInfos>()
  private _fetchMutexMap = new Map<string, Mutex>()
  private _targetGameVersion = ''

  private constructor() {}
  static get instance() {
    if (this._instance == null) {
      this._instance = new AssetFileInfosCache()
    }

    return this._instance
  }

  get targetGameVersion() {
    if (this._targetGameVersion.length < 1) {
      throw new Error('targetGameVersion is not yet set')
    }

    return this._targetGameVersion
  }
  set targetGameVersion(value: string) {
    this._targetGameVersion = value
  }

  getInfos(version: string) {
    return this._cache.get(version)
  }

  async fetchAll(version?: string) {
    version ??= this.targetGameVersion

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
      console.debug('[AssetFileInfosCache] set cache', version)
      this._cache.set(version, data)
      return data
    })
  }
  async fetchFileInfo(filePath: string, version?: string) {
    console.debug('[AssetFileInfosCache] fetchFileInfo: ', filePath)
    const fileInfos = await this.fetchAll(version)

    const slashUnprefixedPath =
      filePath[0] === '/' ? filePath.slice(1) : filePath
    return fileInfos[slashUnprefixedPath] ?? null
  }

  async makeFullFileUrl(filePath: string, version?: string) {
    version ??= this.targetGameVersion

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
