import { CDNBaseUrl } from './constants'
import { AssetFileInfosCache } from './resources/assetFileInfo'

export default async function fetcher<T>(
  url: string,
  useIncremental: boolean = false,
): Promise<{
  fromVersion: string
  data: T
}> {
  const targetGameVersion = AssetFileInfosCache.instance.targetGameVersion
  const slashPrefixedUrl = url.length > 0 && url[0] !== '/' ? `/${url}` : url

  let fromVersion: string
  if (useIncremental) {
    const assetFileInfo = await AssetFileInfosCache.instance.fetchFileInfo(
      slashPrefixedUrl,
      targetGameVersion,
    )
    if (assetFileInfo == null) {
      throw new Error(`Cannot get info of asset file ${slashPrefixedUrl}`)
    }

    fromVersion = assetFileInfo.fromVersion
  } else {
    fromVersion = targetGameVersion
  }

  const fullFileUrl = useIncremental
    ? await AssetFileInfosCache.instance.makeFullFileUrl(
        slashPrefixedUrl,
        targetGameVersion,
      )
    : `${CDNBaseUrl}/${fromVersion}${slashPrefixedUrl}`

  const fetchedData = (await fetch(fullFileUrl).then((r) => r.json())) as T
  return {
    fromVersion,
    data: fetchedData,
  }
}
