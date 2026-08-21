import type { IconAtlasMetadata } from '@depl/shared'
import { useQuery } from '@tanstack/react-query'

import { CDNBaseUrl } from '@/constants'

export interface ItemAtlasMetadataCalculated {
  [key: string]: {
    xOffset: number
    yOffset: number
  }
}

const IconAtlasMetadataCache = new Map<string, ItemAtlasMetadataCalculated>()

export function useIconAtlas(gameVersion: string): {
  data?: ItemAtlasMetadataCalculated
  isLoading: boolean
} {
  const { data, isLoading } = useQuery({
    queryKey: ['iconAtlasMetadata', gameVersion],
    queryFn: () =>
      fetch(
        `${CDNBaseUrl}/${gameVersion}/assets/minecraft/icon-atlas.metadata.json`,
      ).then((res) => res.json() as Promise<IconAtlasMetadata>),
    staleTime: Infinity,
  })

  const existing = IconAtlasMetadataCache.get(gameVersion)
  if (existing) {
    return { data: existing, isLoading: false }
  }

  if (isLoading || data == null) {
    return { data: undefined, isLoading }
  }

  const sq = Math.ceil(Math.sqrt(data.items.length))
  const calculated = data.items.reduce((acc, cur, idx) => {
    const xOffset = (idx % sq) * data.iconSize
    const yOffset = Math.floor(idx / sq) * data.iconSize

    acc[cur] = { xOffset, yOffset }
    return acc
  }, {} as ItemAtlasMetadataCalculated)

  IconAtlasMetadataCache.set(gameVersion, calculated)

  return { data: calculated, isLoading: false }
}
