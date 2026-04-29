import type { QueryFunctionContext } from '@tanstack/react-query'

import { CDNBaseUrl } from '@/constants'
import { queryClient } from '@/lib/query'
import type { CDNItemsListResponse } from '@/types/base'

export async function getItemListQueryFn({
  queryKey,
}: QueryFunctionContext<string[]>) {
  const [, gameVersion] = queryKey
  return (await fetch(
    `${CDNBaseUrl}/${gameVersion}/assets/minecraft/items.json`,
  ).then((res) => res.json())) as CDNItemsListResponse
}

export async function getItemList(gameVersion: string) {
  return await queryClient.fetchQuery({
    queryKey: ['items.json', gameVersion],
    queryFn: getItemListQueryFn,
    staleTime: Infinity,
  })
}
