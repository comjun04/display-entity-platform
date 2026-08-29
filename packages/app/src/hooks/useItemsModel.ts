import { satisfies as semverSatisfies } from 'compare-versions'
import { useEffect, useState } from 'react'

import { getLogger } from '@/lib/logger'
import { fetchItemsModelJson } from '@/lib/resources/items-model'
import { useProjectStore } from '@/stores/projectStore'

const logger = getLogger('useItemsModel()')

export const useItemsModel = (itemType: string) => {
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

        if (model.type === 'minecraft:model') {
          setItemsModelData({
            model: model.model,
          })
        }
      })
      .catch(logger.error)
  }, [itemType, targetGameVersion, shouldUseItemsModel])

  return itemsModelData
}
