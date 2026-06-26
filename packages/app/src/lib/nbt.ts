import mojangson, { type MojangsonList, type MojangsonNode } from 'mojangson'
import { coerce as semverCoerce, satisfies as semverSatisfies } from 'semver'
import type { Matrix4Tuple } from 'three'

import { CommandBlockMaxCommandLength } from '@/constants'
import type {
  DisplayEntity,
  MinimalTextureValue,
  TextEffects,
} from '@/types/base'
import { isItemDisplayPlayerHead } from '@/types/guards'

export function validateSNBT(input: string) {
  // If nbt string does not wrapped with curly brackets, wrap it
  // This is necesseary to make it parsable with mojangson
  if (!input.startsWith('{')) input = '{' + input
  if (!input.endsWith('}')) input += '}'

  try {
    const data = mojangson.parse(input)
    if (data == null) {
      return null
    }

    return data
  } catch {
    return null
  }
}

export type NbtStringGeneratePayload = {
  entity: DisplayEntity
  worldMatrix: Matrix4Tuple // row-major world matrix of that entity
}
export function generateNbtStrings({
  payload,
  targetGameVersion,
  baseTag = '',
  mainNBT = '',
  validateNBT = false,
}: {
  payload: Map<string, NbtStringGeneratePayload>
  targetGameVersion: string
  baseTag: string
  mainNBT: string
  validateNBT: boolean
}): {
  nbtStrings: string[]
  invalidNBTExist: boolean
} {
  let invalidNBTExist = false

  const semveredGameVersion = semverCoerce(targetGameVersion)?.version
  if (semveredGameVersion == null) {
    throw new Error('semveredGameVersion is null, this should not happen')
  }

  // whether item uses data component instead of nbt
  const isItemDataComponentEnabled = semverSatisfies(
    semveredGameVersion,
    '>=1.20.5',
  )
  // whether text is represented as SNBT rather than JSON
  const isTextFormatSNBT = semverSatisfies(semveredGameVersion, '>=1.21.5')

  // =====

  // validate mainNBT and inject baseTag first
  let tagInjectedMainNBT = null
  if (validateNBT) {
    const mainNbtTree = validateSNBT(mainNBT)
    if (mainNbtTree == null) {
      invalidNBTExist = true
    }
    tagInjectedMainNBT =
      mainNbtTree != null ? injectBaseTag(mainNbtTree, baseTag, false) : mainNBT
  } else {
    tagInjectedMainNBT = injectBaseTagSimple(mainNBT, baseTag, false)
  }

  const passengersStrings = [...payload.values()]
    .map(({ entity, worldMatrix }) => {
      // 그룹은 커맨드 생성에 들어가지 않음
      // 그룹 안에 있는 엔티티들은 world transform으로 반영됨
      if (entity.kind === 'group') return

      const idText = entity.kind + '_display' // block_display, item_display, text_display
      const transformationString = worldMatrix
        .map((num) => Math.round(num * 1_0000_0000) / 1_0000_0000 + 'f')
        .join(',')

      let specificData = ''
      if (entity.kind === 'block') {
        const propertiesText = Object.entries(entity.blockstates)
          .map(([k, v]) => `${k}:"${v}"`)
          .join(',')

        specificData = `block_state:{Name:"${entity.type}",Properties:{${propertiesText}}}`
      } else if (entity.kind === 'item') {
        const displayText =
          entity.display != null ? `,item_display:"${entity.display}"` : ''

        let itemExtraData = ''
        if (isItemDisplayPlayerHead(entity)) {
          const textureData = entity.playerHeadProperties.texture
          if (textureData?.baked) {
            const o = {
              textures: {
                SKIN: {
                  url: textureData.url,
                },
              },
            } satisfies MinimalTextureValue
            const textureValueString = btoa(JSON.stringify(o))
            itemExtraData = isItemDataComponentEnabled
              ? `,components:{"minecraft:profile":{properties:[{name:"textures",value:"${textureValueString}"}]}}`
              : `,SkullOwner:{Properties:{textures:[{Value:"${textureValueString}"}]}}`
          }
        }
        specificData = `item:{id:"${entity.type}"${itemExtraData}}${displayText}`
      } else if (entity.kind === 'text') {
        // text
        const text = entity.text
          .replaceAll('\\', '\\\\')
          .replaceAll('\n', isTextFormatSNBT ? '\\n' : '\\\\n')
          .replaceAll('"', '\\"')
        const enabledTextEffects = (
          Object.keys(entity.textEffects) as Array<keyof TextEffects>
        ).filter((k) => entity.textEffects[k])
        const enabledTextEffectsString =
          enabledTextEffects.length > 0
            ? ',' +
              enabledTextEffects
                .map((k) => (isTextFormatSNBT ? `${k}:true` : `"${k}":true`))
                .join(',')
            : ''
        specificData = isTextFormatSNBT
          ? `text:{text:"${text}"${enabledTextEffectsString},color:"#${entity.textColor.toString(16)}"}`
          : `text:'{"text":"${text}"${enabledTextEffectsString},"color":"#${entity.textColor.toString(16)}"}'`

        // TODO: omit optional nbt data if data value is default value

        // alignment
        specificData += `,alignment:"${entity.alignment}"`
        // background_color
        specificData += `,background_color:${entity.backgroundColor}`
        // default_background
        if (entity.defaultBackground) {
          specificData += ',default_background:true'
        }
        // line_width
        specificData += `,line_width:${entity.lineWidth}`
        // see_through
        if (entity.seeThrough) {
          specificData += ',see_through:true'
        }
        // shadow
        if (entity.shadow) {
          specificData += ',shadow:true'
        }
        // text_opacity
        specificData += `,text_opacity:${entity.textOpacity}`
      }

      const generatedString = `{id:"${idText}",${specificData},transformation:[${transformationString}]${entity.nbt.length > 0 ? ',' + entity.nbt : ''}}`

      if (validateNBT) {
        const nbtTree = validateSNBT(generatedString)
        if (nbtTree == null) {
          invalidNBTExist = true
          return generatedString
        }

        // attempt to inject baseTag
        const finalString = injectBaseTag(nbtTree, baseTag, true)
        if (finalString == null) {
          return generatedString
        }

        return finalString
      } else {
        const finalString = injectBaseTagSimple(generatedString, baseTag, true)
        return finalString
      }
    })
    .filter((d) => d != null)

  let le = Infinity
  const baseCommandLength =
    `/summon block_display ~ ~ ~ {${tagInjectedMainNBT},Passengers:[]}`.length
  const groupedPassengersStrings: string[] = []
  for (const passengersStr of passengersStrings) {
    if (
      baseCommandLength + le + passengersStr.length <=
      CommandBlockMaxCommandLength
    ) {
      // split to another summon command if adding up to current entity nbt data
      // overflows the 32500 command block command max length
      groupedPassengersStrings[groupedPassengersStrings.length - 1] +=
        ',' + passengersStr
      le += passengersStr.length + 1 // length including leading `,`
    } else {
      // if adding up to current entity nbt data does not overflow the limit
      // then just add to the last summon command
      groupedPassengersStrings.push(passengersStr)
      le = passengersStr.length
    }
  }

  const newNbtStrings = groupedPassengersStrings.map((str) => {
    const inner = [tagInjectedMainNBT, `Passengers:[${str}]`]
      .filter((str) => str != null && str.length > 0)
      .join(',')
    return '{' + inner + '}'
  })

  return {
    nbtStrings: newNbtStrings,
    invalidNBTExist,
  }
}

function injectBaseTagSimple(
  nbtString: string,
  baseTag: string,
  wrapWithBraces = false,
) {
  if (nbtString.startsWith('{')) nbtString = nbtString.slice(1)
  if (nbtString.endsWith('}')) nbtString = nbtString.slice(0, -1)

  if (baseTag.length < 1) {
    return wrapWithBraces ? `{${nbtString}}` : nbtString
  }

  const injected =
    '{' + (nbtString.length > 0 ? `${nbtString},` : '') + `Tags:["${baseTag}"]}`
  return wrapWithBraces ? injected : injected.slice(1, -1)
}
function injectBaseTag(
  nbtTree: MojangsonNode,
  baseTag: string,
  wrapWithBraces = false,
) {
  if (nbtTree.type !== 'compound') {
    // logger.error(
    //   'Failed to parse entity nbt string. Root element type is not `compound`.',
    // )
    return null
  }

  if (baseTag.length > 0) {
    const tagListNode = nbtTree.value['Tags']
    if (tagListNode?.type !== 'list') {
      nbtTree.value['Tags'] = {
        type: 'list',
        value: {
          type: 'string',
          value: [baseTag],
        },
      } satisfies MojangsonList
    } else {
      tagListNode.value.value.push(baseTag)
    }
  }

  const injected = mojangson.stringify(nbtTree)
  return wrapWithBraces ? injected : injected.slice(1, -1)
}
