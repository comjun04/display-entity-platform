// common

export type Number3Tuple = [number, number, number]

// blockstates

export interface BlockStateApplyModelInfo {
  model: string
  uvlock?: boolean
  x?: number
  y?: number
}

export type BlockstatesData = {
  blockstates: Map<
    string,
    {
      states: Set<string>
      default: string
    }
  >
  models: {
    when: Record<string, string[]>[]
    apply: BlockStateApplyModelInfo[]
  }[]
}

export type BlockStatesFile =
  | {
      variants:
        | Record<string, BlockStateApplyModelInfo>
        | Record<string, BlockStateApplyModelInfo[]>
    }
  | {
      multipart: {
        apply: BlockStateApplyModelInfo | BlockStateApplyModelInfo[]
        when?:
          | {
              AND: Record<string, string>[]
            }
          | {
              OR: Record<string, string>[]
            }
          | Record<string, string>
      }[]
    }

// model

export type ModelDisplayPositionKey =
  | 'thirdperson_righthand'
  | 'thirdperson_lefthand'
  | 'firstperson_righthand'
  | 'firstperson_lefthand'
  | 'gui'
  | 'head'
  | 'ground'
  | 'fixed'
export type ModelFaceKey = 'up' | 'down' | 'north' | 'south' | 'west' | 'east'

export interface ModelElement {
  __comment?: string
  from: Number3Tuple
  to: Number3Tuple
  faces: {
    [x in ModelFaceKey]?: {
      uv?: [number, number, number, number]
      texture: string
      rotation?: 0 | 90 | 180 | 270
      tintindex?: number
    }
  }
  rotation?: {
    origin: Number3Tuple
    axis: 'x' | 'y' | 'z'
    angle: number
    rescale?: boolean
  }
}

export type ModelData = {
  textures: Record<
    string,
    | string
    | {
        // new textures map format added in minecraft 26.1
        sprite: string
        force_translucent: boolean
      }
  >
  textureSize?: [number, number]
  display: Record<
    ModelDisplayPositionKey,
    {
      rotation?: Number3Tuple
      translation?: Number3Tuple
      scale?: Number3Tuple
    }
  >
  elements: ModelElement[]
}

export interface ModelFile {
  parent?: string
  display?: {
    [x in ModelDisplayPositionKey]?: {
      rotation: Number3Tuple
      translation: Number3Tuple
      scale: Number3Tuple
    }
  }
  elements?: ModelElement[]
  textures?: Record<string, string>
  texture_size?: [number, number]
}

// other asset cdn data

export type VersionMetadata = {
  version: number // metadata version
  incremental: boolean // whether asset data is generated incrementally
  gameVersion: string // minecraft version
  sharedAssets: {
    assetIndex: number
    unifontHexFilePath: string
  }
}

export interface AssetFileInfos {
  [filePath: string]: {
    fromVersion: string
  }
}

// texture

export interface TextureValue {
  timestamp: number
  profileId: string // player uuid
  profileName: string // player username
  signatureRequired: boolean | undefined
  textures: {
    SKIN:
      | {
          url: string
          metadata:
            | {
                model: 'slim' | undefined // wide skin = undefined
              }
            | undefined
        }
      | undefined
    CAPE:
      | {
          url: string
        }
      | undefined
  }
}

// backend api

export interface BackendAPIV1GetPlayerSkinResponse {
  id: string // player uuid
  name: string // player username
  skinUrl: string | null
}
