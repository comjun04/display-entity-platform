import { CDNBaseUrl } from './constants'
import { AssetFileInfosCache } from './lib/resources/assetFileInfo'
import { useProjectStore } from './stores/projectStore'

export default async function fetcher<T>(
  url: string,
  useIncremental: boolean = false,
): Promise<{
  fromVersion: string
  data: T
}> {
  const slashPrefixedUrl = url.length > 0 && url[0] !== '/' ? `/${url}` : url

  let fromVersion: string
  if (useIncremental) {
    const assetFileInfo =
      await AssetFileInfosCache.instance.fetchFileInfo(slashPrefixedUrl)
    if (assetFileInfo == null) {
      throw new Error(`Cannot get info of asset file ${slashPrefixedUrl}`)
    }

    fromVersion = assetFileInfo.fromVersion
  } else {
    fromVersion = useProjectStore.getState().targetGameVersion
  }

  const fullFileUrl = useIncremental
    ? await AssetFileInfosCache.instance.makeFullFileUrl(slashPrefixedUrl)
    : `${CDNBaseUrl}/${fromVersion}${slashPrefixedUrl}`

  const fetchedData = (await fetch(fullFileUrl).then((r) => r.json())) as T
  return {
    fromVersion,
    data: fetchedData,
  }
}
