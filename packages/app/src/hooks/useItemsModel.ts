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
        const f = (model: ItemsModel) => {
          switch (model.type) {
            case 'minecraft:model':
              return model.model

            case 'minecraft:select': {
              const foundCase = model.cases.find((targetCase) => {
                const when = Array.isArray(targetCase.when)
                  ? targetCase.when
                  : [targetCase.when]

                switch (model.property) {
                  case 'minecraft:display_context':
                    if (metadata.display == null) return false
                    return when.includes(metadata.display)
                }
              })

              const selectedModel =
                foundCase != null ? foundCase.model : model.fallback
              if (selectedModel == null) return

              return f(selectedModel)
            }
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
