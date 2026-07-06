import type { Node } from '@react-three/fiber'
import {
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PlaneGeometry,
  Texture,
} from 'three'

import { getVersionMetadata } from '@/lib/queries/getVersionMetadata'
import { useClassObjectCacheStore } from '@/stores/cacheStore'
import { useProjectStore } from '@/stores/projectStore'

import { createCharTexture as createBitmapFontCharTexture } from './font/bitmap'
import { createCharTexture as createUnihexFontCharTexture } from './font/unihex'

type Font = 'default' | 'uniform'
interface TextMeshGroupData {
  text: string // TODO: handle Raw JSON Text Format
  font: Font
  lineWidth: number
  textColor: number
  backgroundColor: number
}

const UNIT_PIXEL_SIZE = 0.025
const BackgroundGeometry = new PlaneGeometry(1, 1)

export class TextMeshGroup extends Group {
  private _text = ''
  private _font: Font = 'default'
  private _lineWidth = 100
  private _textColor = 0xffffffff
  private _backgroundColor = 0x00000000

  private backgroundMesh: Mesh
  private backgroundMaterial: MeshBasicMaterial
  private textMeshGroups: Group[] = []

  constructor() {
    super()
    this.matrixAutoUpdate = false

    this.backgroundMaterial = new MeshBasicMaterial({
      color: 0x00000000,
      side: FrontSide,
      opacity: 1,
      transparent: true,
      alphaTest: 0.01,
    })
    this.backgroundMesh = new Mesh(BackgroundGeometry, this.backgroundMaterial)
    this.backgroundMesh.matrixAutoUpdate = false

    this.backgroundMesh.scale.set(0, 0, 0) // make background invisible on creation
    this.backgroundMesh.updateMatrix()

    this.add(this.backgroundMesh)
  }

  get text() {
    return this._text
  }
  get font() {
    return this._font
  }
  get lineWidth() {
    return this._lineWidth
  }
  get textColor() {
    return this._textColor
  }
  get backgroundColor() {
    return this._backgroundColor
  }

  async updateData(data: TextMeshGroupData) {
    const shouldRecreate = data.text !== this.text || data.font !== this._font

    if (shouldRecreate) {
      // start recreating
      const groups: Group[] = []

      // 모든 줄 통틀어서 최대 width를 가진 줄의 width
      let maxLineWidth = 0
      let offset = 0
      const tempCharMeshList: Mesh[] = []

      for (const [charIdx, char] of data.text.split('').entries()) {
        if (char === '\n') {
          const lineGroup = new Group()
          lineGroup.add(...tempCharMeshList)
          groups.push(lineGroup)

          tempCharMeshList.length = 0
          offset = 0
          continue
        }

        // 텍스트 중간에 SPACE 문자가 2개 이상 연속으로 붙어 있더라도 최대 1개만 렌더링 (마크 동작)
        if (char === ' ') {
          const prevChar = data.text[charIdx - 1]
          if (prevChar === ' ') {
            continue
          }
        }

        // TODO: mesh를 만들지 않고도 width를 구하는 함수 만들기
        const {
          mesh,
          widthPixels,
          // baseWidthPixels,
          heightPixels,
          advance,
          ascent,
          font: charFont,
        } = await createCharMesh(char, data.font, data.textColor)

        const width = widthPixels

        // 주어진 line length보다 한 줄에 입력된 글자의 픽셀 수(여백 포함)가 크면
        // 해당 글자부터 다음 줄로 내리기
        if (offset + width > data.lineWidth) {
          // 입력한 글자 전까지 한 줄로 묶기
          if (tempCharMeshList.length > 0) {
            const lineGroup = new Group()
            lineGroup.add(...tempCharMeshList)
            groups.push(lineGroup)

            if (offset > maxLineWidth) {
              maxLineWidth = offset
            }
          }

          // 입력한 글자는 다음 줄로 예약
          tempCharMeshList.length = 0
          tempCharMeshList.push(mesh)

          offset = 1
        } else {
          // 각 줄의 첫 글자일 경우 왼쪽에 1픽셀 여백
          if (tempCharMeshList.length < 1) {
            offset = 1
          }

          tempCharMeshList.push(mesh)
        }

        const height = heightPixels / (charFont === 'uniform' ? 2 : 1)

        mesh.position.setX(offset)
        mesh.position.setY(1 - (height - ascent))
        offset += advance

        if (offset > maxLineWidth) {
          maxLineWidth = offset
        }
      }
      if (tempCharMeshList.length > 0) {
        // 마지막 문자까지
        const lineGroup = new Group()
        lineGroup.add(...tempCharMeshList)
        groups.push(lineGroup)
      }

      // remove old rows and add new rows
      this.textMeshGroups.forEach((group) => {
        group.children.forEach((object) => {
          const mesh = object as Mesh

          mesh.geometry.dispose()

          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          materials.forEach((material) => material.dispose())
        })
        this.remove(group)
      })

      this.textMeshGroups = groups
      for (const group of groups) {
        this.add(group)
      }

      // positioning rows

      let maxHeight = 0

      for (const lineGroup of groups.toReversed()) {
        lineGroup.position.set(
          (maxLineWidth / 2) * -1, // 중앙에 위치하도록 조정
          maxHeight + 1, // 각 줄마다 하단 1픽셀씩 올리기
          0,
        )

        // 각 row 간 간격 고정값
        // net.minecraft.client.renderer.entity.DisplayEntityRenderer.TextDisplayRenderer#renderInner()
        maxHeight += 10
      }

      const backgroundColorAlpha = ((data.backgroundColor >>> 24) & 0xff) / 0xff
      const backgroundColorRGB = (data.backgroundColor << 8) >>> 8 // ensure unsigned
      this.backgroundMaterial.color.setHex(backgroundColorRGB)
      this.backgroundMaterial.opacity = backgroundColorAlpha

      this.backgroundMesh.position.set(0, maxHeight / 2, 0)
      this.backgroundMesh.scale.set(maxLineWidth, maxHeight, 1)
      this.backgroundMesh.updateMatrix()

      this.scale.set(UNIT_PIXEL_SIZE, UNIT_PIXEL_SIZE, UNIT_PIXEL_SIZE)

      // update class properties
      this._text = data.text
      this._font = data.font
      this._lineWidth = data.lineWidth
      this._textColor = data.textColor
      this._backgroundColor = data.backgroundColor

      this.updateMatrix()
    } else {
      if (data.textColor !== this._textColor) {
        for (const group of this.textMeshGroups) {
          for (const object of group.children) {
            const mesh = object as Mesh

            const materials = Array.isArray(mesh.material)
              ? mesh.material
              : [mesh.material]
            materials.forEach((material) =>
              (material as MeshBasicMaterial).color.setHex(data.textColor),
            )
          }
        }
      }

      if (data.backgroundColor !== this._backgroundColor) {
        const backgroundColorAlpha =
          ((data.backgroundColor >>> 24) & 0xff) / 0xff
        const backgroundColorRGB = (data.backgroundColor << 8) >>> 8 // ensure unsigned

        this.backgroundMaterial.color.setHex(backgroundColorRGB)
        this.backgroundMaterial.opacity = backgroundColorAlpha

        this._backgroundColor = data.backgroundColor
      }
    }
  }
}

// This should change when upgrading to r3f v9 (react v19), as global JSX namespace is deprecated
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      textMeshGroup: Node<TextMeshGroup, typeof TextMeshGroup>
    }
  }
}

async function createCharMesh(char: string, preferFont: Font, color: number) {
  let texture!: Texture
  let geometry!: PlaneGeometry
  let width!: number // 여백 자르고 난 뒤의 width
  let baseWidth!: number // 여백 자르기 전 원래 width
  let height!: number
  let advance!: number
  let ascent!: number

  // check for cached glyph data
  const { fontGlyphs: cache, setFontGlyph } =
    useClassObjectCacheStore.getState()

  let fontKey: string = preferFont
  if (preferFont === 'uniform') {
    // unifont glyphs need to be treated separately by assetIndex id
    const { targetGameVersion } = useProjectStore.getState()
    const versionMetadata = await getVersionMetadata(targetGameVersion)
    fontKey += `;${versionMetadata.sharedAssets.assetIndex}`
  }
  const key = `${fontKey};${char.charCodeAt(0).toString(16)}`

  const d = cache.get(key)
  if (d != null) {
    geometry = d.geometry
    texture = d.texture
    width = d.widthPixels
    baseWidth = d.baseWidthPixels
    height = d.heightPixels
    advance = d.advance
    ascent = d.ascent
  } else {
    if (preferFont === 'default') {
      const d = await createBitmapFontCharTexture(char)
      if (d == null) {
        return await createCharMesh(char, 'uniform', color)
      }

      texture = d.texture
      width = d.width
      baseWidth = d.baseWidth
      height = d.height
      advance = d.advance
      ascent = d.ascent

      geometry = new PlaneGeometry(width, d.height)
      geometry.translate(width / 2, d.height / 2, 0.1)
    } else if (preferFont === 'uniform') {
      const d = await createUnihexFontCharTexture(char)

      texture = d.texture
      width = d.width
      baseWidth = d.baseWidth
      height = d.height
      advance = d.advance
      ascent = 7 // temp value. unifont does not have ascent

      geometry = new PlaneGeometry(width, height)
      geometry.translate(width / 2, height / 2, 0.1)
      geometry.scale(0.5, 0.5, 0.5) // unifont는 한 줄에 bitmap font보다 2배 많은 픽셀 수가 들어감
    }

    texture.minFilter = NearestFilter
    texture.magFilter = NearestFilter

    // cache glyph data
    setFontGlyph(key, {
      geometry,
      texture,
      widthPixels: width,
      baseWidthPixels: baseWidth,
      heightPixels: height,
      advance,
      ascent,
    })
  }

  const material = new MeshBasicMaterial({
    map: texture,
    color,
    side: FrontSide,
    transparent: true,
    opacity: 1,
    alphaTest: 0.01,
  })

  const mesh = new Mesh(geometry, material)
  return {
    mesh,
    widthPixels: width,
    baseWidthPixels: baseWidth,
    heightPixels: height,
    advance,
    ascent,
    font: preferFont,
  }
}
