import { IconAtlasGeneratorConfig } from '@depl/shared'

export interface APIGetJobsResponse {
  targetGameVersion: string
  jobs: (IconAtlasGeneratorConfig['items'][string] & { id: string })[]
}
