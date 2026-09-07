import type { ModelDisplayPositionKey } from '@depl/shared'
import { satisfies as semverSatisfies } from 'compare-versions'
import { useEffect, useState } from 'react'

import { getLogger } from '@/lib/logger'
import { fetchItemsModelJson } from '@/lib/resources/items-model'
import { stripMinecraftPrefix } from '@/lib/utils'
import { useProjectStore } from '@/stores/projectStore'
import type { ItemsModel } from '@/types/items-model'

const logger = getLogger('useItemsModel()')

export const useItemsModel = (
  itemType: string,
  metadata: {
    display: ModelDisplayPositionKey | null
  },
) => {
  const [itemsModelData, setItemsModelData] = useState<{
    model: string
  }>()

  const targetGameVersion = useProjectStore((state) => state.targetGameVersion)
  const shouldUseItemsModel = semverSatisfies(targetGameVersion, '>=1.21.4')

  useEffect(() => {
    if (!shouldUseItemsModel) {
      setItemsModelData({
        model: `item/${itemType}`,
      })
      return
    }

    fetchItemsModelJson(itemType)
      .then(({ model }) => {
        // TODO: check items model data with current item
        const f: (model: ItemsModel) => string | null = (model) => {
          switch (model.type) {
            case 'minecraft:model':
              return model.model

            case 'minecraft:condition': {
              let condition: boolean
              switch (model.property) {
                case 'minecraft:using_item':
                  condition = false
                  break
                default:
                  logger.warn(
                    `Unhandled minecraft:condition property: ${model.property}, using falsy result.`,
                  )
                  condition = false
              }

              return f(condition ? model.on_true : model.on_false)
            }

            case 'minecraft:select': {
              const foundCase = model.cases.find((targetCase) => {
                const when = Array.isArray(targetCase.when)
                  ? targetCase.when
                  : [targetCase.when]

                switch (model.property) {
                  case 'minecraft:block_state':
                    if (
                      itemType === 'light' &&
                      model.block_state_property === 'level'
                    ) {
                      // items using this: light
                      return when.includes('15') // light level 15
                    }

                    logger.warn(
                      `Unhandled minecraft:select block_state property: ${model.property}`,
                    )
                    return false

                  case 'minecraft:context_dimension':
                    // assume dimension type as overworld
                    // items using this: clock
                    return when.includes('minecraft:overworld')

                  case 'minecraft:display_context':
                    if (metadata.display == null) return false
                    return when.includes(metadata.display)

                  // no armor trims by default
                  // items using this: *_helmet, *_chestplate, *_leggings, *_boots
                  case 'minecraft:trim_material':
                    return false

                  default:
                    logger.warn(
                      `Unhandled minecraft:select property: ${model.property}`,
                    )
                    return false
                }
              })

              const selectedModel =
                foundCase != null ? foundCase.model : model.fallback
              if (selectedModel == null) return null

              return f(selectedModel)
            }

            case 'minecraft:range_dispatch': {
              let value = 0

              switch (model.property) {
                // items using this: compass, recovery_compass
                case 'minecraft:compass':
                  // return direction as always north
                  // as there are no spawn, lodestone, or recovery anchor in editor
                  value = 0
                  break

                // items using this: clock
                case 'minecraft:time':
                  if (model.source === 'daytime')
                    // return time as always noon, as there are no time settings in editor
                    value = 0 // noon
                  else value = 0
                  break

                default:
                  logger.warn(
                    `Unhandled minecraft:range_dispatch property: ${model.property}`,
                  )
              }
              value *= model.scale ?? 1

              const foundEntry = model.entries.findLast(
                (entry) => entry.threshold <= value,
              )
              const selectedModel =
                foundEntry != null ? foundEntry.model : model.fallback
              if (selectedModel == null) return null

              return f(selectedModel)
            }

            default:
              logger.warn(`Unhandled items model type: ${model.type}`)
              return null
          }
        }

        const modelResourceLocation = f(model)
        if (modelResourceLocation != null) {
          setItemsModelData({
            model: stripMinecraftPrefix(modelResourceLocation),
          })
        }
      })
      .catch(logger.error)
  }, [itemType, targetGameVersion, shouldUseItemsModel, metadata.display])

  return itemsModelData
}
