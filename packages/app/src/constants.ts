// eslint does not recognize vite-env.d.ts definition, so just ignore it
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
export const CDNBaseUrl = import.meta.env.VITE_CDN_BASE_URL

export const BackendHost = import.meta.env.VITE_BACKEND_HOST
/* eslint-enable @typescript-eslint/no-unsafe-assignment */

export const GameVersions = [
  {
    id: '26.1',
    label: '26.1',
  },
  {
    id: '1.21.11',
    label: '1.21.11',
  },
  {
    id: '1.21.9',
    label: '1.21.9 ~ 1.21.10',
  },
  {
    id: '1.21.7',
    label: '1.21.7 ~ 1.21.8',
  },
  {
    id: '1.21.6',
    label: '1.21.6',
  },
  {
    id: '1.21.5',
    label: '1.21.5',
  },
  {
    id: '1.21.4',
    label: '1.21.4',
  },
  {
    id: '1.21.2',
    label: '1.21.2 ~ 1.21.3',
  },
  {
    id: '1.21',
    label: '1.21 ~ 1.21.1',
  },
  {
    id: '1.20.5',
    label: '1.20.5 ~ 1.20.6',
  },
  {
    id: '1.20.3',
    label: '1.20.3 ~ 1.20.4',
  },
  {
    id: '1.20.2',
    label: '1.20.2',
  },
  {
    id: '1.20',
    label: '1.20 ~ 1.20.1',
  },
  {
    id: '1.19.4',
    label: '1.19.4',
  },
]
export const LegacyHardcodedGameVersion = '1.21'
export const LatestGameVersion = GameVersions[0].id
