import { Mutex } from 'async-mutex'

import fetcher from '@/fetcher'
import type { ItemsModelFile } from '@/types/items-model'

import { AssetFileInfosCache } from './assetFileInfo'

const jsonCache = new Map<string, ItemsModelFile>()
const jsonLoadMutexMap = new Map<string, Mutex>()

export async function fetchItemsModelJson(itemId: string) {
  const modelFileFromVersion = await AssetFileInfosCache.instance.fetchFileInfo(
    `/assets/minecraft/items/${itemId}.json`,
  )
  if (modelFileFromVersion == null) {
    throw new Error(`Cannot get info of items model file: ${itemId}`)
  }

  const key = `${modelFileFromVersion.fromVersion};${itemId}`

  if (!jsonLoadMutexMap.has(key)) {
    jsonLoadMutexMap.set(key, new Mutex())
  }
  const mutex = jsonLoadMutexMap.get(key)!
  return await mutex.runExclusive(async () => {
    let itemsModelJson = jsonCache.get(key)
    if (itemsModelJson == null) {
      const { data } = await fetcher<ItemsModelFile>(
        `/assets/minecraft/items/${itemId}.json`,
        true,
      )
      itemsModelJson = data
      jsonCache.set(key, itemsModelJson)
    }

    return itemsModelJson
  })
}
