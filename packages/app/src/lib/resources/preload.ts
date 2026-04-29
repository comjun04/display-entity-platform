import type {
  BlockStateApplyModelInfo,
  DisplayEntity,
  PlayerHeadProperties,
} from '@/types/base'
import { isItemDisplayPlayerHead } from '@/types/guards'

import { getLogger } from '../logger'
import { getMatchingBlockstateModel, loadBlockstates } from './blockstates'
import { loadModel } from './model'
import { loadModelMaterials } from './modelMesh'

const logger = getLogger('ResourceLoader')

export async function preloadResources(entities: DisplayEntity[]) {
  const applyModelInfoList: (BlockStateApplyModelInfo & {
    playerHeadTextureData?: NonNullable<PlayerHeadProperties['texture']>
  })[] = []

  logger.log('preLoadResources(): start preloading resources')
  const preLoadingStartTime = performance.now()

  const blockstatesBatchLoadStartTime = preLoadingStartTime
  const blockstatesBatchLoadResults = await Promise.allSettled(
    entities.map(async (entity) => {
      if (entity.kind === 'block') {
        const blockstatesData = await loadBlockstates(entity.type)

        const matchingModelInfoArr = getMatchingBlockstateModel(
          blockstatesData,
          entity.blockstates,
        )
        applyModelInfoList.push(...matchingModelInfoArr)
      } else if (entity.kind === 'item') {
        applyModelInfoList.push({
          model: `item/${entity.type}`,
          playerHeadTextureData: isItemDisplayPlayerHead(entity)
            ? (entity.playerHeadProperties.texture ?? undefined)
            : undefined,
        })
      }
    }),
  )

  const blockstatesBatchLoadTimeDiff = Math.round(
    performance.now() - blockstatesBatchLoadStartTime,
  )
  const blockstatesBatchLoadSuccessCount = blockstatesBatchLoadResults.filter(
    (d) => d.status === 'fulfilled',
  ).length
  logger.log(
    `preLoadResources(): batch loaded entity blockstates data, took ${blockstatesBatchLoadTimeDiff}ms.`,
    `Total ${blockstatesBatchLoadResults.length}, success ${blockstatesBatchLoadSuccessCount}, failed ${blockstatesBatchLoadResults.length - blockstatesBatchLoadSuccessCount}`,
  )

  const batchLoadStartTime = performance.now()
  const batchLoadResults = await Promise.allSettled(
    applyModelInfoList.map(async (applyModelInfo) => {
      const modelData = await loadModel(applyModelInfo.model)
      const { data } = modelData

      await loadModelMaterials({
        modelResourceLocation: applyModelInfo.model,
        elements: data.elements,
        textures: data.textures,
        isItemModel: false,
        playerHeadData:
          applyModelInfo.playerHeadTextureData != null
            ? {
                textureData: applyModelInfo.playerHeadTextureData,
                showSecondLayer: true,
              }
            : undefined,
      })
    }),
  )

  const batchLoadTimeDiff = Math.round(performance.now() - batchLoadStartTime)
  const batchLoadSuccessCount = batchLoadResults.filter(
    (d) => d.status === 'fulfilled',
  ).length
  logger.log(
    `preLoadResources(): batch loaded entity model data and material assets, took ${batchLoadTimeDiff}ms.`,
    `Total ${batchLoadResults.length}, success ${batchLoadSuccessCount}, failed ${batchLoadResults.length - batchLoadSuccessCount}`,
  )

  const preLoadingTimeDiff = Math.round(performance.now() - preLoadingStartTime)
  logger.log(
    `preLoadResources(): finish preloading resources, took ${preLoadingTimeDiff}ms`,
  )
}
