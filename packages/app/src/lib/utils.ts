import { type ClassValue, clsx } from 'clsx'
import { coerce as semverCoerce, satisfies as semverSatisfies } from 'semver'
import { twMerge } from 'tailwind-merge'

import { AssetFileInfosCache } from '../stores/cacheStore'
import type { ModelElement, ModelFaceKey } from '../types/base'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function encodeBinaryToBase64(binaryData: Uint8Array) {
  let str = ''
  for (let i = 0; i < binaryData.length; i += 8192) {
    const chunk = binaryData.subarray(i, i + 8192)
    str += String.fromCharCode(...chunk) // split input into chunks because too many arguments will throw error
  }
  const encoded = window.btoa(str)

  return encoded
}
export function decodeBase64ToBinary(encodedString: string) {
  const atobDecodedStr = window.atob(encodedString)
  const byteArr = new Uint8Array(new ArrayBuffer(atobDecodedStr.length))
  for (let i = 0; i < atobDecodedStr.length; i++) {
    byteArr[i] = atobDecodedStr.charCodeAt(i)
  }

  return byteArr
}

export async function gzip(data: string, blobType?: string) {
  const gzipCompressionStream = new Blob([data])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  const blob = await new Response(gzipCompressionStream).blob()
  const typedBlob = new Blob([blob], {
    type: blobType ?? 'application/octet-stream', // prevent chrome mobile from downloading as `project.depl.txt`
  })

  return typedBlob
}
export async function gunzip(blob: Blob) {
  const gzipDecompressionStream = blob
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
  const decompressedData = await new Response(gzipDecompressionStream).text()

  return decompressedData
}

export function stripMinecraftPrefix(input: string) {
  return input.startsWith('minecraft:') ? input.slice(10) : input
}

export function isValidTextureUrl(url: string) {
  return /^http(s)?:\/\/textures.minecraft.net\/texture\/[0-9a-f]+$/g.test(url)
}

type ItemModelBorderFaceKey = Exclude<ModelFaceKey, 'north' | 'south'>
export async function generateBuiltinItemModel(
  textureResourceLocation: string,
  layerNumber: number,
) {
  const layerId = `#layer${layerNumber}`

  const modelJson: {
    elements: ModelElement[]
  } = {
    elements: [
      {
        from: [-8, -8, -0.5],
        to: [8, 8, 0.5],
        faces: {
          north: { uv: [16, 0, 0, 16], texture: layerId },
          south: { uv: [0, 0, 16, 16], texture: layerId },
        },
      },
    ],
  }

  const textureImage = new Image()
  textureImage.crossOrigin = 'anonymous'
  textureImage.src = await AssetFileInfosCache.instance.makeFullFileUrl(
    `/assets/minecraft/textures/${textureResourceLocation}.png`,
  )
  await new Promise((resolve) => {
    textureImage.onload = resolve
  })

  const canvas = document.createElement('canvas')
  // willReadFrequently: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  const width = 16
  const height = 16
  canvas.width = width
  canvas.height = height

  ctx.drawImage(textureImage, 0, 0, 16, 16, 0, 0, 16, 16)

  const checkPixelEmpty = (x: number, y: number) => {
    if (x < 0 || x > width) return true
    if (y < 0 || y > height) return true

    const alpha = ctx.getImageData(x, y, 1, 1).data[3]
    if (alpha === 0) return true

    return false
  }

  const mergedPixelBorders: {
    direction: ItemModelBorderFaceKey
    rangeStart: [number, number]
    rangeEnd: [number, number]
  }[] = []

  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      // Skip if pixel is empty
      if (checkPixelEmpty(x, y)) continue

      const neighbours = {
        up: [x, y - 1],
        down: [x, y + 1],
        east: [x + 1, y],
        west: [x - 1, y],
      } as const

      // NOTE: element template for one pixel drawing
      // const elementTemplate: ModelElement = {
      //   from: [x - 8, 16 - (y + 1) - 8, -0.5],
      //   to: [x + 1 - 8, 16 - y - 8, 0.5],
      //   faces: {},
      // }

      for (const [faceName, direction] of Object.entries(neighbours)) {
        if (checkPixelEmpty(...direction)) {
          const existingPixelBorderGroup = mergedPixelBorders.find(
            (d) =>
              d.direction === (faceName as ItemModelBorderFaceKey) &&
              (d.direction === 'up' || d.direction === 'down'
                ? // horizontal line merging, x changes, y is locked
                  d.rangeStart[1] === y &&
                  d.rangeEnd[1] === y &&
                  d.rangeEnd[0] === x - 1
                : // vertical line merging, x is locked, y changes
                  d.rangeStart[0] === x &&
                  d.rangeEnd[0] === x &&
                  d.rangeEnd[1] === y - 1),
          )
          if (existingPixelBorderGroup != null) {
            // if existing merged pixel border group found, extend rangeEnd
            if (
              existingPixelBorderGroup.direction === 'up' ||
              existingPixelBorderGroup.direction === 'down'
            ) {
              existingPixelBorderGroup.rangeEnd[0] = x
            } else {
              existingPixelBorderGroup.rangeEnd[1] = y
            }
          } else {
            mergedPixelBorders.push({
              direction: faceName as ItemModelBorderFaceKey,
              rangeStart: [x, y],
              rangeEnd: [x, y],
            })
          }
        }
      }
    }
  }

  for (const borderGroup of mergedPixelBorders) {
    const element: ModelElement = {
      from: [
        borderGroup.rangeStart[0] - 8,
        16 - (borderGroup.rangeEnd[1] + 1) - 8,
        -0.5,
      ],
      to: [
        borderGroup.rangeEnd[0] + 1 - 8,
        16 - borderGroup.rangeStart[1] - 8,
        0.5,
      ],
      faces: {
        [borderGroup.direction]: {
          // ts does not check missing key errors inside here idk why
          texture: layerId,
          uv: [
            borderGroup.rangeStart[0],
            borderGroup.rangeStart[1],
            borderGroup.rangeEnd[0] + 1,
            borderGroup.rangeEnd[1] + 1,
          ],
        },
      },
    }
    modelJson.elements.push(element)
  }

  return modelJson
}

// ==========

const blocksUsingDefaultGrassColors = [
  'grass_block',
  'short_grass',
  'tall_grass',
  'fern',
  'large_fern_top',
  'large_fern_bottom',
  'potted_fern',
]
const blocksUsingDefaultFoliageColors = [
  'oak_leaves',
  'jungle_leaves',
  'acacia_leaves',
  'dark_oak_leaves',
  'vine',
  'mangrove_leaves',
]
export function getTextureColor(
  modelResourceLocation: string,
  gameVersion: string,
  textureLayer?: string,
  tintindex?: number,
) {
  const isBlockModel = modelResourceLocation.startsWith('block/')
  const modelName = modelResourceLocation.split('/').slice(1).join('/')

  const semveredGameVersion = semverCoerce(gameVersion)?.version
  if (semveredGameVersion == null) {
    throw new Error(`Invalid game version ${gameVersion}`)
  }

  if (textureLayer == null && tintindex == null) {
    return 0xffffff
  }

  // 잔디 색
  // item display의 경우 tintindex가 없어도 항상 색상 적용됨
  if (
    blocksUsingDefaultGrassColors.includes(modelName) &&
    (!isBlockModel || tintindex === 0)
  ) {
    // https://minecraft.fandom.com/wiki/Grass_Block#Item
    return 0x7cbd6b
  }

  if (
    blocksUsingDefaultFoliageColors.includes(modelName) &&
    (!isBlockModel || tintindex === 0)
  ) {
    // net.minecraft.world.biome.FoliageColors.getDefaultColor()
    return 0x48b518
  }
  if (modelName === 'birch_leaves' && (!isBlockModel || tintindex === 0)) {
    // net.minecraft.world.biome.FoliageColors.getBirchColor()
    return 0x80a755
  }
  if (modelName === 'spruce_leaves' && (!isBlockModel || tintindex === 0)) {
    // net.minecraft.world.biome.FoliageColors.getSpruceColor()
    return 0x619961
  }

  // lily_pad
  if (modelName === 'lily_pad') {
    // minecraft wiki에 0x208030이라고 적혀 있지만, 블록 디스플레이로 렌더링할 때는 다른 색을 사용
    // net.minecraft.world.biome.FoliageColors class 코드에서 확인 가능
    return 0x71c35c
  }

  // 수박, 호박 줄기
  // minecraft:block/melon_stem_stage{n} (0 <= n <= 7)
  // minecraft:block/pumpkin_stem_stage{n}
  if (/^block\/(melon|pumpkin)_stem_stage[0-7]$/.test(modelResourceLocation)) {
    const age = modelResourceLocation.slice(-1)
    switch (age) {
      case '0':
        return 0x00ff00
      case '1':
        return 0x20f704
      case '2':
        return 0x40ef08
      case '3':
        return 0x60e70c
      case '4':
        return 0x80df10
      case '5':
        return 0xa0d714
      case '6':
        return 0xc0cf18
      case '7':
        return 0xe0c71c
    }
  }

  // 다 자란 수박/호박 줄기
  if (
    ['block/attached_melon_stem', 'block/attached_pumpkin_stem'].includes(
      modelResourceLocation,
    )
  ) {
    return 0xe0c71c
  }

  // redstone_wire
  if (
    modelResourceLocation.startsWith('block/redstone_dust_') &&
    tintindex === 0
  ) {
    // 항상 꺼진 상태
    return 0x4b0000
  }

  // 스폰알 아이템
  if (
    modelResourceLocation.startsWith('item/') &&
    modelResourceLocation.endsWith('_spawn_egg') &&
    semverSatisfies(semveredGameVersion, '<1.21.5') // minecraft uses unique textures for spawn eggs since 1.21.5
  ) {
    const spawnEggType = modelResourceLocation.slice(5, -10)
    const isOverlay = textureLayer === '1'

    // https://minecraft.wiki/w/Spawn_Egg_colors#Java_Edition
    switch (spawnEggType) {
      case 'allay':
        return isOverlay ? 0x00adff : 0x00daff
      case 'armadillo':
        return isOverlay ? 0x824848 : 0xad716d
      case 'axolotl':
        return isOverlay ? 0xa62d74 : 0xfbc1e3
      case 'bat':
        return isOverlay ? 0x0f0f0f : 0x4c3e30
      case 'bee':
        return isOverlay ? 0x43241b : 0xedc343
      case 'blaze':
        return isOverlay ? 0xfff87e : 0xf6b201
      case 'bogged':
        return isOverlay ? 0x314d1b : 0x8a9c72
      case 'breeze':
        return isOverlay ? 0x9166df : 0xaf94df
      case 'camel':
        return isOverlay ? 0xcb9337 : 0xfcc369
      case 'cat':
        return isOverlay ? 0x957256 : 0xefc88e
      case 'cave_spider':
        return isOverlay ? 0xa80e0e : 0x0c424e
      case 'chicken':
        return isOverlay ? 0xff0000 : 0xa1a1a1
      case 'cod':
        return isOverlay ? 0xe5c48b : 0xc1a76a
      case 'cow':
        return isOverlay ? 0xa1a1a1 : 0x443626
      case 'creaking':
        return isOverlay ? 0xfc7812 : 0x5f5f5f
      case 'creeper':
        return isOverlay ? 0x000000 : 0x0da70b
      case 'dolphin':
        return isOverlay ? 0xf9f9f9 : 0x223b4d
      case 'donkey':
        return isOverlay ? 0x867566 : 0x534539
      case 'drowned':
        return isOverlay ? 0x799c65 : 0x8ff1d7
      case 'elder_guardian':
        return isOverlay ? 0x747693 : 0xceccba
      case 'ender_dragon':
        return isOverlay ? 0xe079fa : 0x1c1c1c
      case 'enderman':
        return isOverlay ? 0x000000 : 0x161616
      case 'endermite':
        return isOverlay ? 0x6e6e6e : 0x161616
      case 'evoker':
        return isOverlay ? 0x1e1c1a : 0x959b9b
      case 'fox':
        return isOverlay ? 0xcc6920 : 0xd5b69f
      case 'frog':
        return isOverlay ? 0xffc77c : 0xd07444
      case 'ghast':
        return isOverlay ? 0xbcbcbc : 0xf9f9f9
      case 'glow_squid':
        return isOverlay ? 0x85f1bc : 0x095656
      case 'goat':
        return isOverlay ? 0x55493e : 0xa5947c
      case 'guardian':
        return isOverlay ? 0xf17d30 : 0x5a8272
      case 'hoglin':
        return isOverlay ? 0x5f6464 : 0xc66e55
      case 'horse':
        return isOverlay ? 0xeee500 : 0xc09e7d
      case 'husk':
        return isOverlay ? 0xe6cc94 : 0x797061
      case 'iron_golem':
        return isOverlay ? 0x74a332 : 0xdbcdc2
      case 'llama':
        return isOverlay ? 0x995f40 : 0xc09e7d
      case 'magma_cube':
        return isOverlay ? 0xfcfc00 : 0x340000
      case 'mooshroom':
        return isOverlay ? 0xb7b7b7 : 0xa00f10
      case 'mule':
        return isOverlay ? 0x51331d : 0x1b0200
      case 'ocelot':
        return isOverlay ? 0x564434 : 0xefde7d
      case 'panda':
        return isOverlay ? 0x1b1b22 : 0xe7e7e7
      case 'parrot':
        return isOverlay ? 0xff0000 : 0x0da70b
      case 'phantom':
        return isOverlay ? 0x88ff00 : 0x43518a
      case 'pig':
        return isOverlay ? 0xdb635f : 0xf0a5a2
      case 'piglin':
        return isOverlay ? 0xf9f3a4 : 0x995f40
      case 'piglin_brute':
        return isOverlay ? 0xf9f3a4 : 0x592a10
      case 'pillager':
        return isOverlay ? 0x959b9b : 0x532f36
      case 'polar_bear':
        return isOverlay ? 0xd5d6cd : 0xeeeede
      case 'pufferfish':
        return isOverlay ? 0x37c3f2 : 0xf6b201
      case 'rabbit':
        return isOverlay ? 0x734831 : 0x995f40
      case 'ravager':
        return isOverlay ? 0x5b5049 : 0x757470
      case 'salmon':
        return isOverlay ? 0x0e8474 : 0xa00f10
      case 'sheep':
        return isOverlay ? 0xffb5b5 : 0xe7e7e7
      case 'shulker':
        return isOverlay ? 0x4d3852 : 0x946794
      case 'silverfish':
        return isOverlay ? 0x303030 : 0x6e6e6e
      case 'skeleton':
        return isOverlay ? 0x494949 : 0xc1c1c1
      case 'skeleton_horse':
        return isOverlay ? 0xe5e5d8 : 0x68684f
      case 'slime':
        return isOverlay ? 0x7ebf6e : 0x51a03e
      case 'sniffer':
        return isOverlay ? 0x25ab70 : 0x871e09
      case 'snow_golem':
        return isOverlay ? 0x81a4a4 : 0xd9f2f2
      case 'spider':
        return isOverlay ? 0xa80e0e : 0x342d27
      case 'squid':
        return isOverlay ? 0x708899 : 0x223b4d
      case 'stray':
        return isOverlay ? 0xddeaea : 0x617677
      case 'strider':
        return isOverlay ? 0x4d494d : 0x9c3436
      case 'tadpole':
        return isOverlay ? 0x160a00 : 0x6d533d
      case 'trader_llama':
        return isOverlay ? 0x456296 : 0xeaa430
      case 'tropical_fish':
        return isOverlay ? 0xfff9ef : 0xef6915
      case 'turtle':
        return isOverlay ? 0x00afaf : 0xe7e7e7
      case 'vex':
        return isOverlay ? 0xe8edf1 : 0x7a90a4
      case 'villager':
        return isOverlay ? 0xbd8b72 : 0x563c33
      case 'vindicator':
        return isOverlay ? 0x275e61 : 0x959b9b
      case 'wandering_trader':
        return isOverlay ? 0xeaa430 : 0x456296
      case 'warden':
        return isOverlay ? 0x39d6e0 : 0x0f4649
      case 'witch':
        return isOverlay ? 0x51a03e : 0x340000
      case 'wither':
        return isOverlay ? 0x4d72a0 : 0x141414
      case 'wither_skeleton':
        return isOverlay ? 0x474d4d : 0x141414
      case 'wolf':
        return isOverlay ? 0xceaf96 : 0xd7d3d3
      case 'zoglin':
        return isOverlay ? 0xe6e6e6 : 0xc66e55
      case 'zombie':
        return isOverlay ? 0x799c65 : 0x00afaf
      case 'zombie_horse':
        return isOverlay ? 0x97c284 : 0x315234
      case 'zombie_villager':
        return isOverlay ? 0x799c65 : 0x563c33
      case 'zombified_piglin':
        return isOverlay ? 0x4c7129 : 0xea9393
    }
  }

  return 0xffffff
}

export function getFormattedShortcutKeyString(rawKeysInput: string | string[]) {
  const rawKeys = Array.isArray(rawKeysInput)
    ? rawKeysInput
    : rawKeysInput.split(' ')
  const keys = rawKeys.map((key) => {
    if (key === 'Control') {
      return 'Ctrl'
    }
    if (key.length === 1) {
      // print single-character keys like alphabets as uppercase
      return key.toUpperCase()
    }

    return key
  })
  return keys.join(' + ')
}
