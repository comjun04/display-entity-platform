import { IconAtlasGeneratorConfig } from '@depl/shared'

export interface APIGetJobsResponse {
  targetGameVersion: string
  jobs: (IconAtlasGeneratorConfig['items'][string] & { id: string })[]
}

export interface APISubmitJobsBody {
  atlasImage: string // base64 encoded .png file
  iconSize: number
}
export interface APISubmitJobsResponse {
  result: 'success'
}

export interface AtlasImageMetadata {
  items: string[]
  iconSize: number
}
