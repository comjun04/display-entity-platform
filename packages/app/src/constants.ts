// eslint does not recognize vite-env.d.ts definition, so just ignore it
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
export const CDNBaseUrl = import.meta.env.VITE_CDN_BASE_URL

export const BackendHost = import.meta.env.VITE_BACKEND_HOST
/* eslint-enable @typescript-eslint/no-unsafe-assignment */

export const GameVersions: {
  id: string
  label: string
  datapackVersion: number
}[] = [
  {
    id: '26.1',
    label: '26.1',
    datapackVersion: 101,
  },
  {
    id: '1.21.11',
    label: '1.21.11',
    datapackVersion: 94,
  },
  {
    id: '1.21.9',
    label: '1.21.9 ~ 1.21.10',
    datapackVersion: 88,
  },
  {
    id: '1.21.7',
    label: '1.21.7 ~ 1.21.8',
    datapackVersion: 81,
  },
  {
    id: '1.21.6',
    label: '1.21.6',
    datapackVersion: 80,
  },
  {
    id: '1.21.5',
    label: '1.21.5',
    datapackVersion: 71,
  },
  {
    id: '1.21.4',
    label: '1.21.4',
    datapackVersion: 61,
  },
  {
    id: '1.21.2',
    label: '1.21.2 ~ 1.21.3',
    datapackVersion: 57,
  },
  {
    id: '1.21',
    label: '1.21 ~ 1.21.1',
    datapackVersion: 48,
  },
  {
    id: '1.20.5',
    label: '1.20.5 ~ 1.20.6',
    datapackVersion: 41,
  },
  {
    id: '1.20.3',
    label: '1.20.3 ~ 1.20.4',
    datapackVersion: 26,
  },
  {
    id: '1.20.2',
    label: '1.20.2',
    datapackVersion: 18,
  },
  {
    id: '1.20',
    label: '1.20 ~ 1.20.1',
    datapackVersion: 15,
  },
  {
    id: '1.19.4',
    label: '1.19.4',
    datapackVersion: 14,
  },
]
export const LegacyHardcodedGameVersion = '1.21'
export const LatestGameVersion = GameVersions[0].id

export const CommandBlockMaxCommandLength = 32500
