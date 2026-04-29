import { Mutex } from 'async-mutex'
import { CanvasTexture, ImageLoader } from 'three'

import fetcher from '@/fetcher'
import { stripMinecraftPrefix } from '@/lib/utils'
import { AssetFileInfosCache, useCacheStore } from '@/stores/cacheStore'
import type { CDNFontProviderResponse } from '@/types/base'

const imageLoader = new ImageLoader()
imageLoader.setCrossOrigin('anonymous')
export async function createCharTexture(char: string) {
  const glyphData = await getGlyphData(char)
  if (glyphData == null) {
    return null
  }

  const img = await imageLoader.loadAsync(
    await AssetFileInfosCache.instance.makeFullFileUrl(
      `/assets/minecraft/textures/${stripMinecraftPrefix(glyphData.file)}`,
    ),
  )

  const canvas = document.createElement('canvas')
  canvas.width = glyphData.actualWidth
  canvas.height = glyphData.height
  const canvasCtx = canvas.getContext('2d')!
  canvasCtx.drawImage(
    img,
    glyphData.width * glyphData.col,
    glyphData.height * glyphData.row,
    glyphData.actualWidth,
    glyphData.height,
    0,
    0,
    glyphData.actualWidth,
    glyphData.height,
  )

  const texture = new CanvasTexture(canvas)
  return {
    texture,
    width: glyphData.actualWidth,
    baseWidth: glyphData.width,
    height: glyphData.height,
    advance: glyphData.advance,
    ascent: glyphData.ascent,
  }
}

const fontProvidersLoadMutex = new Mutex()
async function getGlyphData(char: string) {
  return await fontProvidersLoadMutex.runExclusive(async () => {
    const { fontProviders, setFontProviders } = useCacheStore.getState()

    // load character providers
    let defaultFontProviders = fontProviders['provider.default']
    if (fontProviders['provider.default'] == null) {
      const {
        data: { providers },
      } = await fetcher<CDNFontProviderResponse>(
        '/assets/minecraft/font/include/default.json',
        true,
      )
      setFontProviders('provider.default', providers)
      defaultFontProviders = providers
    }

    // find character
    for (const provider of defaultFontProviders.filter(
      (provider) => provider.type === 'bitmap',
    )) {
      for (let i = 0; i < provider.chars.length; i++) {
        const idx = provider.chars[i].indexOf(char[0])
        if (idx >= 0) {
          const img = await imageLoader.loadAsync(
            await AssetFileInfosCache.instance.makeFullFileUrl(
              `/assets/minecraft/textures/${stripMinecraftPrefix(provider.file)}`,
            ),
          )

          const width = img.width / provider.chars[0].length
          const height = provider.height ?? 8
          const actualCharHeight = img.height / provider.chars.length
          // net.minecraft.client.gui.font.providers.BitmapProvider.Definition#load()
          const heightRatio = height / actualCharHeight
          const actualWidth = getActualGlyphWidth(
            img,
            idx,
            i,
            width,
            actualCharHeight,
          )

          return {
            file: provider.file,
            width,
            height,
            actualWidth,
            advance: Math.round(actualWidth * heightRatio) + 1,
            ascent: provider.ascent,
            row: i,
            col: idx,
          }
        }
      }
    }
  })
}

function getActualGlyphWidth(
  atlasImg: HTMLImageElement,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(
    atlasImg,
    offsetX * width,
    offsetY * height,
    width,
    height,
    0,
    0,
    width,
    height,
  )
  const pixelData = ctx.getImageData(0, 0, width, height).data

  // scan for non-transparent area
  // check from the rightmost column
  for (let x = width - 1; x >= 0; x--) {
    for (let y = height - 1; y >= 0; y--) {
      const idx = y * width + x
      const alpha = pixelData[idx * 4 + 3]
      // break if any pixel of that column is not transparent
      if (alpha !== 0) {
        return x + 1
      }
    }
  }

  // if the character is blank (no pixels), use a fallbacl 1x1
  return 1
}
