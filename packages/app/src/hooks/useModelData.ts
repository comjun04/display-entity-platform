import { useEffect, useState } from 'react'

import { getLogger } from '@/lib/logger'
import { loadModel } from '@/lib/resources/model'
import { useProjectStore } from '@/stores/projectStore'

const logger = getLogger('useModelData()')

const useModelData = (resourceLocation?: string) => {
  const [modelData, setModelData] =
    useState<Awaited<ReturnType<typeof loadModel>>>()
  const [loading, setLoading] = useState(false)

  const targetGameVersion = useProjectStore((state) => state.targetGameVersion)

  useEffect(() => {
    if (resourceLocation == null) return

    setLoading(true)

    loadModel(resourceLocation)
      .then((data) => {
        setModelData(data)
        setLoading(false)
      })
      .catch((err) => {
        logger.error(err)

        setModelData(undefined)
        setLoading(false)
      })
  }, [resourceLocation, targetGameVersion])

  return {
    data: modelData,
    loading,
  }
}

export default useModelData
