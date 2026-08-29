import type { Number3Tuple } from '@depl/shared'

// https://minecraft.wiki/w/Items_model_definition

export interface ItemsModelFile {
  model: ItemsModel
}

export type ItemsModel = (
  | ItemsModelPlain
  | ItemsModelComposite
  | ItemsModelCondition
  | ItemsModelSelect
  | ItemsModelRangeDispatch
  | ItemsModelEmpty
  | ItemsModelBundleStackedItem
  | ItemsModelSpecial
) & {
  transformation: unknown
}

export interface ItemsModelPlain {
  type: 'minecraft:model'
  model: string // resource location
  tints: unknown[] // TODO
}

export interface ItemsModelComposite {
  type: 'minecraft:composite'
  models: ItemsModel[]
}

export interface ItemsModelCondition {
  type: 'minecraft:condition'
  property:
    | 'minecraft:broken'
    | 'minecraft:bundle/has_selected_item'
    | 'minecraft:carried'
    | 'minecraft:component'
    | 'minecraft:damaged'
    | 'minecraft:extended_view'
    | 'minecraft:fishing_rod/cast'
    | 'minecraft:has_component'
    | 'minecraft:keybind_down'
    | 'minecraft:selected'
    | 'minecraft:using_item'
    | 'minecraft:view_entity'
    | 'minecraft:custom_model_data'
  on_true: ItemsModel
  on_false: ItemsModel
}

export type ItemsModelSelect = {
  type: 'minecraft:select'
  cases: {
    when: string | string[]
    model: ItemsModel
  }[]
  fallback?: ItemsModel
} & (
  | {
      property:
        | 'minecraft:charge_type'
        | 'minecraft:context_dimension'
        | 'minecraft:context_entity_type'
        | 'minecraft:display_context'
        | 'minecraft:main_hand'
        | 'minecraft:trim_material'
    }
  | {
      property: 'minecraft:block_state'
      block_state_property: string
    }
  | {
      property: 'minecraft:component'
      component: string
    }
  | {
      property: 'minecraft:local_time'

      locale?: string
      time_zone?: string
      pattern: string
    }
  | {
      property: 'minecraft:custom_model_data'
      index?: number
    }
)

export type ItemsModelRangeDispatch = {
  type: 'minecraft:range_dispatch'
  scale?: number
  entries: {
    threshold: number
    model: ItemsModel
  }[]
  fallback?: ItemsModel
} & (
  | {
      type:
        | 'minecraft:bundle/fullness'
        | 'minecraft:cooldown'
        | 'minecraft:crossbow/pull'
    }
  | {
      property: 'minecraft:compass'
      target: 'spawn' | 'lodestone' | 'recovery' | 'none'
      wobble?: boolean
    }
  | {
      property: 'minecraft:count' | 'minecraft:damage'
      normalize?: boolean
    }
  | {
      property: 'minecraft:time'
      source: 'daytime' | 'moon_phase' | 'random'
      wobble?: boolean
    }
  | {
      property: 'minecraft:use_cycle'
      period?: number
    }
  | {
      property: 'minecraft:use_duration'
      remaining?: boolean
    }
  | {
      property: 'minecraft:custom_model_data'
      index?: number
    }
)

export interface ItemsModelEmpty {
  type: 'minecraft:empty'
}
export interface ItemsModelBundleStackedItem {
  type: 'minecraft:bundle/selected_item'
}

export interface ItemsModelSpecial {
  type: 'minecraft:special'
  model: ItemsModelSpecialModelType
  base: string
}

// tint sources

export interface TintSourceConstant {
  type: 'minecraft:constant'
  value: number | Number3Tuple
}
export interface TintSource_Dye {
  type: 'minecraft:dye'
  default: number | Number3Tuple
}
export interface TintSourceFirework {
  type: 'minecraft:firework'
  default: number | Number3Tuple
}
export interface TintSourceGrass {
  type: 'minecraft:grass'
  temperature: number
  downfall: number
}
export interface TintSourceMapColor {
  // will be removed in minecraft 26.3
  type: 'minecraft:map_color'
  default: number | Number3Tuple
}
export interface TintSourcePotion {
  type: 'minecraft:firework'
  default: number | Number3Tuple
}

// special items model types
export type ItemsModelSpecialModelType =
  | {
      type:
        | 'minecraft:bell'
        | 'minecraft:conduit'
        | 'minecraft:decorated_pot'
        | 'minecraft:player_head'
        | 'minecraft:shield'
        | 'minecraft:trident'
    }
  | {
      type: 'minecraft:banner'
      attachment?: 'ground' | 'wall'
      color: string
    }
  | {
      type: 'minecraft:book'
      texture: string
      chest_type?: string
      openness?: number
    }
  | {
      type: 'copper_golem_statue'
      pose: 'sitting' | 'running' | 'star' | 'standing'
      texture: string
    }
  | {
      type: 'minecraft:end_cube'
      effect: 'gateway' | 'portal'
    }
  | {
      type: 'minecraft:head'
      kind:
        | 'skeleton'
        | 'wither_skeleton'
        | 'player'
        | 'zombie'
        | 'creeper'
        | 'piglin'
        | 'dragon'
      texture?: string
      animation?: number
    }
  | {
      type: 'minecraft:shulker_box'
      texture: string
      openness?: number
    }
