import { BlockIconGeneratorConfig } from '@depl/shared'

export interface APIGetJobsResponse {
  targetGameVersion: string
  jobs: (BlockIconGeneratorConfig['items'][string] & { id: string })[]
}
