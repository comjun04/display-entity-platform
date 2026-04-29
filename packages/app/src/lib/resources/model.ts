import { Mutex } from 'async-mutex'

import fetcher from '@/fetcher'
import { generateBuiltinItemModel, stripMinecraftPrefix } from '@/lib/utils'
import { AssetFileInfosCache } from '@/stores/cacheStore'
import type { ModelData, ModelElement, ModelFile } from '@/types/base'

import { getLogger } from '../logger'

const logger = getLogger('ResourceLoader/model')

const modelJsonCache = new Map<string, ModelFile>()
const modelJsonLoadMutexMap = new Map<string, Mutex>()

const modelDataCache = new Map<
  string,
  {
    data: ModelData
    isBlockShapedItemModel: boolean
  }
>()
const modelDataLoadMutexMap = new Map<string, Mutex>()

async function fetchModelJson(resourceLocation: string) {
  const modelFileFromVersion = await AssetFileInfosCache.instance.fetchFileInfo(
    `/assets/minecraft/models/${resourceLocation}.json`,
  )
  if (modelFileFromVersion == null) {
    throw new Error(`Cannot get info of model file ${resourceLocation}`)
  }

  const key = `${modelFileFromVersion.fromVersion};${resourceLocation}`

  if (!modelJsonLoadMutexMap.has(key)) {
    modelJsonLoadMutexMap.set(key, new Mutex())
  }
  const mutex = modelJsonLoadMutexMap.get(key)!
  return await mutex.runExclusive(async () => {
    let modelJson = modelJsonCache.get(key)
    if (modelJson == null) {
      const { data } = await fetcher<ModelFile>(
        `/assets/minecraft/models/${resourceLocation}.json`,
        true,
      )
      modelJson = data
      modelJsonCache.set(key, modelJson)
    }

    return modelJson
  })
}

export async function loadModel(resourceLocation: string) {
  const rootModelFileInfo = await AssetFileInfosCache.instance.fetchFileInfo(
    `/assets/minecraft/models/${resourceLocation}.json`,
  )
  if (rootModelFileInfo == null) {
    throw new Error('')
  }

  const key = `${rootModelFileInfo.fromVersion};${resourceLocation}`

  if (!modelDataLoadMutexMap.has(key)) {
    modelDataLoadMutexMap.set(key, new Mutex())
  }
  const mutex = modelDataLoadMutexMap.get(key)!

  return await mutex.runExclusive(async () => {
    /*
    const cachedModelData = modelData[resourceLocation]
    if (cachedModelData != null) {
      return cachedModelData
    }
    */

    const cachedModelData = modelDataCache.get(key)
    if (cachedModelData != null) {
      return cachedModelData
    }

    logger.log(`Loading model for ${resourceLocation}`)

    const isItemModel =
      stripMinecraftPrefix(resourceLocation).startsWith('item/')

    let isBlockShapedItemModel = false

    let textures: Record<string, string> = {}

    let display = {} as ModelData['display']
    let elements: ModelElement[] = []

    let textureSize: [number, number] | undefined = undefined

    const f = async (currentResourceLocation: string) => {
      const resourceLocationData = await fetchModelJson(currentResourceLocation)

      // 불러온 model 데이터들을 합쳐서 저장 (기존 데이터 우선)
      textures = { ...resourceLocationData.textures, ...textures }
      display = { ...resourceLocationData.display, ...display }
      if (
        elements.length < 1 &&
        resourceLocationData.elements != null &&
        resourceLocationData.elements.length > 0
      ) {
        // elements는 한 파일에서만 설정 가능하므로 이미 설정된 elements가 없을 경우에만 설정
        elements = resourceLocationData.elements
      }

      if (resourceLocationData.texture_size != null && textureSize == null) {
        textureSize = resourceLocationData.texture_size
      }

      // parent가 없으면 최상위 모델 파일이므로 로딩 끝내기
      if (resourceLocationData.parent == null) {
        return
      }

      if (resourceLocationData.parent === 'builtin/generated') {
        // elements가 따로 정의되어 있지 않다면 아이템 모델 generate 수행
        if (
          elements.length < 1 &&
          (resourceLocationData.elements == null ||
            resourceLocationData.elements.length < 1)
        ) {
          // item display model 파일에 parent가 builtin/generated인 경우
          // layer{n} 텍스쳐 이미지에서 모델 구조를 직접 생성
          const textureLayerPromises = Object.keys(textures)
            .filter((key) => /^layer\d{1,}$/.test(key))
            .sort((a, b) => parseInt(a.slice(5)) - parseInt(b.slice(5))) // layer0, layer1 등에서 `layer` 자르기
            .map((key) =>
              generateBuiltinItemModel(
                stripMinecraftPrefix(textures[key]),
                parseInt(key.slice(5)),
              ),
            )
          try {
            const generatedItemModels = await Promise.all(textureLayerPromises)
            elements = elements.concat(
              ...generatedItemModels.map((d) => d.elements),
            )

            // parent가 builtin/generated이면 최상위 모델 파일과 다름없으므로 로딩 끝내기
            return
          } catch (err) {
            logger.error(err)
          }
        }
      } else {
        if (isItemModel && resourceLocationData.parent?.startsWith('block/')) {
          isBlockShapedItemModel = true
        }

        // parent 값이 있다면 재귀호출로 parent의 model 데이터를 불러오도록 처리
        await f(stripMinecraftPrefix(resourceLocationData.parent))
      }
    }

    await f(resourceLocation).catch(logger.error)

    // 모델 데이터 로딩 및 계산이 완료되었고 elements 데이터가 있다면
    // 다음에 로드 시 모델 데이터를 다시 계산할 필요가 없도록 캐싱
    const newModelData: ModelData = {
      elements,
      textures,
      display,
      textureSize,
    }

    // setCachedModelData(key, newModelData, isBlockShapedItemModel)
    modelDataCache.set(key, {
      data: newModelData,
      isBlockShapedItemModel,
    })
    return { data: newModelData, isBlockShapedItemModel }
  })
}
