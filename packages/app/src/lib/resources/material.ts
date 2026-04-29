import { Mutex } from 'async-mutex'
import {
  DataTexture,
  ImageLoader,
  MeshStandardMaterial,
  NearestFilter,
  type Texture,
  TextureLoader,
} from 'three'

import { getTextureColor } from '@/lib/utils'
import {
  AssetFileInfosCache,
  useCacheStore,
  useClassObjectCacheStore,
} from '@/stores/cacheStore'
import { useProjectStore } from '@/stores/projectStore'

const materialLoadMutexMap = new Map<string, Mutex>()

type TextureData =
  | {
      type: 'vanilla'
      resourceLocation: string
    }
  | {
      type: 'player_head'
      playerHead: {
        showSecondLayer: boolean
      } & (
        | {
            baked: true
            url: string
          }
        | {
            baked: false
            paintTexturePixels: number[]
          }
      )
    }
export type LoadMaterialArgs = {
  textureData: TextureData
  modelResourceLocation: string
  textureLayer?: string
  tintindex?: number
}

export async function loadMaterial({
  textureData,
  modelResourceLocation,
  textureLayer,
  tintindex,
}: LoadMaterialArgs) {
  const { setMaterial } = useClassObjectCacheStore.getState()

  const { targetGameVersion } = useProjectStore.getState()
  const textureColor = getTextureColor(
    modelResourceLocation,
    targetGameVersion,
    textureLayer,
    tintindex,
  )

  if (textureData.type === 'vanilla' || textureData.playerHead.baked) {
    const textureFileFromVersion = await getTextureFileFromVersion(textureData)

    let materialKey: string
    if (textureData.type === 'player_head') {
      if (textureData.playerHead.baked) {
        materialKey = `#player_head;${textureData.playerHead.url.split('/').slice(-1)[0]};${textureData.playerHead.showSecondLayer}` // same as textureKey
      } else {
        throw new Error('This should not happen')
      }
    } else {
      materialKey = `${textureFileFromVersion};${textureData.resourceLocation};${textureColor}`
    }

    // 동시에 여러 번 로딩하지 않도록 key값을 기준으로 lock을 구현
    if (!materialLoadMutexMap.has(materialKey)) {
      materialLoadMutexMap.set(materialKey, new Mutex())
    }
    const mutex = materialLoadMutexMap.get(materialKey)!
    return await mutex.runExclusive(async () => {
      // check for cached
      const { materials } = useClassObjectCacheStore.getState()
      if (materials.has(materialKey)) {
        return {
          material: materials.get(materialKey)!,
          materialKey,
        }
      }

      const material = await makeMaterial(textureData, textureColor)

      setMaterial(materialKey, material)
      return { material, materialKey }
    })
  } else {
    // do not cache unbaked player_head texture
    const material = await makeMaterial(textureData, textureColor)
    return { material, materialKey: '' }
  }
}

const textureLoader = new TextureLoader()
export async function makeMaterial(
  textureData: TextureData,
  textureColor: number,
) {
  // process texture

  let texture: Texture
  if (textureData.type === 'player_head' && !textureData.playerHead.baked) {
    texture = new DataTexture(
      new Uint8ClampedArray(textureData.playerHead.paintTexturePixels),
      64,
      64,
    )
    texture.needsUpdate = true
    texture.flipY = true
  } else {
    const { dataUrl } = await loadTextureImage(textureData)
    texture = await textureLoader.loadAsync(dataUrl)
  }

  // 텍스쳐 픽셀끼리 뭉쳐져서 blur되어 보이지 않게 설정
  // https://discourse.threejs.org/t/low-resolution-texture-is-very-blurry-how-can-i-get-around-this-issue/29948
  // https://github.com/mrdoob/three.js/blob/37d6f280a5cd642e801469bb048f52300d31258e/examples/webgl_geometry_minecraft.html#L154
  texture.magFilter = NearestFilter
  // SRGB로 설정해야 텍스쳐에 하얀색 끼가 들어가지 않고 제대로 보임임
  texture.colorSpace = 'srgb'

  // create material object and cache it
  const material = new MeshStandardMaterial({
    map: texture,
    transparent: true,
    //  transparent일 경우 빈 공간을 transparent 처리하면 opacity=0이 되는데
    //  alphaTest > 0 이어야 빈 공간이 실제로 렌더링되지 않음 (안 할 경우 빈 공간이 다른 mesh도 안보이게 만듬)
    alphaTest: 0.01,
    toneMapped: false, // 인게임에서는 블록이 실제 텍스쳐보다 덜 선명하게 렌더링됨
    color: textureColor,
  })
  return material
}

async function getTextureFileFromVersion(textureData: TextureData) {
  let textureFileFromVersion = ''
  if (textureData.type === 'vanilla') {
    const assetFileInfo = await AssetFileInfosCache.instance.fetchFileInfo(
      `/assets/minecraft/textures/${textureData.resourceLocation}.png`,
    )
    if (assetFileInfo == null) {
      throw new Error(
        `Cannot get info of texture asset file ${textureData.resourceLocation}`,
      )
    }

    textureFileFromVersion = assetFileInfo.fromVersion
  }

  return textureFileFromVersion
}

const imageLoader = new ImageLoader()
export async function loadTextureImage(textureData: TextureData) {
  if (textureData.type === 'player_head' && !textureData.playerHead.baked) {
    throw new Error(
      'Loading unbaked player_head texture is not supported. Consider using raw pixel array.',
    )
  }

  const { croppedTextureDataUrls, setCroppedTextureDataUrl } =
    useCacheStore.getState()

  const textureFileFromVersion = await getTextureFileFromVersion(textureData)
  let textureKey: string
  if (textureData.type === 'player_head') {
    if (textureData.playerHead.baked) {
      textureKey = `#player_head;${textureData.playerHead.url.split('/').slice(-1)[0]};${textureData.playerHead.showSecondLayer}`
    } else {
      throw new Error('This should not happen')
    }
  } else {
    textureKey = `${textureFileFromVersion};${textureData.resourceLocation}`
  }

  let cachedCroppedTextureDataUrl = croppedTextureDataUrls[textureKey]
  if (cachedCroppedTextureDataUrl == null) {
    let imageUrl: string
    if (textureData.type === 'player_head') {
      if (textureData.playerHead.baked) {
        // minecraft texture url can be provided as http:
        // so to prevent mixed content error/warning, match protocol with current page
        imageUrl = matchUrlProtocolWithCurrentPage(textureData.playerHead.url)
      } else {
        throw new Error('This should not happen')
      }
    } else {
      imageUrl = await AssetFileInfosCache.instance.makeFullFileUrl(
        `/assets/minecraft/textures/${textureData.resourceLocation}.png`,
      )
    }

    const img = await imageLoader.loadAsync(imageUrl)

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    const { width } = img
    canvas.width = width
    // 애니메이션이 있는 블록들은 세로로 각 애니메이션 프레임을 붙여놨으므로
    // 맨 처음 프레임만 잘라서 로드
    canvas.height = width

    ctx.drawImage(
      img,
      0,
      0,
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height,
    )

    if (
      textureData.type === 'player_head' &&
      !textureData.playerHead.showSecondLayer
    ) {
      // erase second layer part
      ctx.clearRect(32, 0, 32, 16)
    }

    const croppedTextureDataUrl = canvas.toDataURL()
    cachedCroppedTextureDataUrl = croppedTextureDataUrl
    setCroppedTextureDataUrl(textureKey, croppedTextureDataUrl)

    return {
      image: img,
      dataUrl: croppedTextureDataUrl,
      textureFileFromVersion,
    }
  } else {
    const img = new Image()
    img.src = cachedCroppedTextureDataUrl
    return {
      image: img,
      dataUrl: cachedCroppedTextureDataUrl,
      textureFileFromVersion,
    }
  }
}

function matchUrlProtocolWithCurrentPage(url: string) {
  const urlObj = new URL(url)
  urlObj.protocol = window.location.protocol // match http/https protocol with current page to prevent mixed content error
  return urlObj.toString()
}
