import type {
  BlockStateApplyModelInfo,
  BlockStatesFile,
  ModelDisplayPositionKey,
  ModelElement,
  Number3Tuple,
} from '@depl/shared'
import type { MutableRefObject, RefCallback } from 'react'
import type { Matrix4Tuple } from 'three'

// re-export imported types from shared package
export type {
  BlockStateApplyModelInfo,
  BlockStatesFile,
  ModelDisplayPositionKey,
  ModelElement,
  Number3Tuple,
}

export type {
  AssetFileInfos,
  BackendAPIV1GetPlayerSkinResponse,
  ModelFaceKey,
  ModelFile,
  TextureValue,
  VersionMetadata,
} from '@depl/shared'

// ===========

declare global {
  var __depl_alertUncaughtError: boolean | undefined
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Function // eslint-disable-line @typescript-eslint/no-unsafe-function-type
      ? T[P]
      : DeepPartial<T[P]>
    : T[P]
}

/**
 * ref에 커스텀 함수(callback)을 쓸 수 있으면서
 * 동시에 `current` 값도 사용할 수 있는 Ref
 */
export type RefCallbackWithMutableRefObject<T> = RefCallback<T> &
  MutableRefObject<T>

export type PartialNumber3Tuple = [
  number | undefined,
  number | undefined,
  number | undefined,
]

export type CDNBlocksListResponse = {
  blocks: string[]
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

export type ModelData = {
  textures: Record<string, string>
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

export type CDNItemsListResponse = {
  items: string[]
}

export type FontProvider =
  | {
      type: 'bitmap'
      ascent: number
      chars: string[]
      file: string
      height?: number
    }
  | {
      type: 'space'
      advances: Record<string, number>
    }
  | {
      type: 'unihex'
      hex_file: string // resource location to zip file which includes .hex files
      size_overrides: UnifontSizeOverrideEntry[]
      filter?: Record<string, boolean> // todo: find the filter condition key
    }

export type CDNFontProviderResponse = {
  providers: FontProvider[]
}

export interface UnifontSizeOverrideEntry {
  __ranges: string[]
  from: string
  to: string
  left: number
  right: number
}

export type BaseDisplayEntity = {
  id: string
  parent?: string
  size: Number3Tuple
  position: Number3Tuple
  rotation: Number3Tuple
}

export type BlockDisplayEntity = BaseDisplayEntity & {
  kind: 'block'
  type: string
  blockstates: Record<string, string>
  display: ModelDisplayPositionKey | null
}

export type ItemDisplayEntity = BaseDisplayEntity & {
  kind: 'item'
  type: string
  display: ModelDisplayPositionKey | null
  playerHeadProperties?: PlayerHeadProperties // will be available if type === 'player_head'
}

export interface PlayerHeadProperties {
  texture:
    | {
        baked: true
        url: string
      }
    | {
        baked: false
        // paintTexture: string // base64 string of texture
        paintTexturePixels: number[]
      }
    | null
}

export type TextDisplayAlignment = 'left' | 'center' | 'right'
export type TextEffects = {
  bold: boolean
  italic: boolean
  underlined: boolean
  strikethrough: boolean
  obfuscated: boolean
}

export type TextDisplayEntity = BaseDisplayEntity & {
  kind: 'text'
  text: string
  // global text color
  // will be replaced with advanced text editor
  textColor: number // RGB
  // global text effects
  // will be replaced with advanced text editor
  textEffects: TextEffects
  alignment: TextDisplayAlignment
  backgroundColor: number // ARGB
  defaultBackground: boolean // default_background
  lineWidth: number
  seeThrough: boolean
  shadow: boolean
  textOpacity: number // 0 ~ 255
}

export type DisplayEntityGroup = BaseDisplayEntity & {
  kind: 'group'
  name: string
  children: string[] // list of entity ids
}

export type DisplayEntity =
  | BlockDisplayEntity
  | ItemDisplayEntity
  | TextDisplayEntity
  | DisplayEntityGroup

export type DisplayEntitySaveDataItem = {
  transforms: Matrix4Tuple
} & (
  | Pick<BlockDisplayEntity, 'kind' | 'type' | 'blockstates' | 'display'>
  | Omit<ItemDisplayEntity, 'id' | 'parent' | 'position' | 'rotation' | 'size'>
  | Omit<TextDisplayEntity, 'id' | 'parent' | 'position' | 'rotation' | 'size'>
  | (Pick<DisplayEntityGroup, 'kind' | 'name'> & {
      children: DisplayEntitySaveDataItem[]
    })
)

// BDEngine

export type BDEngineSaveData = {
  isCollection: true
  name: string
  transforms: Matrix4Tuple
  children: BDEngineSaveDataItem[]
  settings: { defaultBrightness: boolean }
  mainNBT: string
}[]

export type BDEngineSaveDataItem = {
  name: string
  nbt: string
  transforms: Matrix4Tuple
  brightness: {
    sky: number
    block: number
  }
} & (
  | {
      isBlockDisplay: true
    }
  | {
      isTextDisplay: true
      name: string // text
      options: {
        color: string // text color, #abcdef
        alpha: number // text color alpha, 0 ~ 1
        backgroundColor: string // #abcdef
        backgroundColorAlpha: number // 0 ~ 1
        bold: boolean
        italic: boolean
        underline: boolean
        strikeThrough: boolean
        obfuscated: boolean
        lineLength: number
        align: TextDisplayAlignment
      }
    }
  | {
      isItemDisplay: true

      // below fields exist if type is player_head
      tagHead?: {
        Value: string
      }
      textureValueList?: string[] // maybe?
      paintTexture?: string // unbaked texture data url
      defaultTextureValue?: string // baked texture url
    }
  | {
      isCollection: true
      children: BDEngineSaveDataItem[]
    }
)

export interface MinimalTextureValue {
  textures: {
    SKIN: {
      url: string
    }
  }
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type History =
  | {
      type: 'createEntities'
      beforeState: Record<string, never>
      afterState: {
        entities: DisplayEntity[]
      }
    }
  | {
      type: 'deleteEntities'
      beforeState: {
        entities: DisplayEntity[]
      }
      afterState: Record<string, never>
    }
  | {
      type: 'group' | 'ungroup'
      parentGroupId: string
      childrenEntityIds: string[]
    }
  | {
      type: 'changeProperties'
      entities: {
        id: string
        beforeState: HistoryChangePropertiesState
        afterState: HistoryChangePropertiesState
      }[]
    }

type HistoryChangePropertiesStateCommonOmitKeys = 'kind' | 'id' | 'parent'
type HistoryChangePropertiesState =
  | (Pick<BlockDisplayEntity, 'kind'> &
      Partial<
        Omit<BlockDisplayEntity, HistoryChangePropertiesStateCommonOmitKeys>
      >)
  | (Pick<ItemDisplayEntity, 'kind'> &
      Partial<
        Omit<ItemDisplayEntity, HistoryChangePropertiesStateCommonOmitKeys> & {
          playerHeadProperties: PlayerHeadProperties
        }
      >)
  | (Pick<TextDisplayEntity, 'kind'> &
      // extract position, rotation, size as non-DeepPartial as DeepPartial breaks Number3Tuple constraints
      Partial<Pick<TextDisplayEntity, 'position' | 'rotation' | 'size'>> &
      DeepPartial<
        Omit<
          TextDisplayEntity,
          | HistoryChangePropertiesStateCommonOmitKeys
          | 'position'
          | 'rotation'
          | 'size'
        >
      >)
  | (Pick<DisplayEntityGroup, 'kind'> &
      Partial<
        Omit<
          DisplayEntityGroup,
          HistoryChangePropertiesStateCommonOmitKeys | 'children'
        >
      >)

// mineskin

export interface MineSkinAPIV2_QueueSkinGenerationBody {
  url: string // image url or base64 data uri
  variant?: 'classic' | 'slim' | 'unknown'
  name?: string
  visibility?: 'public' | 'unlisted' | 'private'
  cape?: string // uuid
}

export type MineSkinAPIV2_QueueSkinGenerationResponse =
  | {
      success: true
      job: {
        id: string
        status: 'unknown' | 'waiting' | 'active' | 'failed' | 'completed'
        result?: string
        timestamp?: number
        eta?: number
      }
      skin?: {
        texture: {
          url: {
            skin: string
          }
        }
      }
    }
  | {
      success: false
      errors: {
        code: string
        message: string
      }[]
    }

export interface MineSkinAPIV2_ListQueueJobsResponse {
  jobs: {
    id: string
    status: 'unknown' | 'waiting' | 'active' | 'failed' | 'completed'
    result?: string
    timestamp?: number
    eta?: number
  }[]
}

export type MineSkinAPIV2_QueueJobDetailResponse =
  | {
      success: true
      skin: {
        texture: {
          url: {
            skin: string
          }
        }
      }
    }
  | {
      success: false
      errors: {
        code: string
        message: string
      }[]
    }
