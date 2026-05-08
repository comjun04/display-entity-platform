import { nanoid } from 'nanoid'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'

import type {
  BDEngineSaveData,
  BDEngineSaveDataItem,
  DisplayEntity,
  ModelDisplayPositionKey,
  Number3Tuple,
  TextureValue,
} from '@/types/base'
import { isItemDisplayPlayerHead } from '@/types/guards'

export async function importBDEngineProjectFrom(saveData: BDEngineSaveData) {
  const entities = new Map<string, DisplayEntity>()

  const tempMatrix4 = new Matrix4()
  const tempPositionVec = new Vector3()
  const tempScaleVec = new Vector3()
  const tempQuaternion = new Quaternion()
  const tempEuler = new Euler()

  const f: (
    items: BDEngineSaveDataItem[],
    parentEntityId?: string,
  ) => Promise<(string | null)[]> = async (items, parentEntityId) => {
    return await Promise.all(
      items.map(async (item) => {
        const id = nanoid(16)

        tempMatrix4.fromArray(item.transforms).transpose()
        tempMatrix4.decompose(tempPositionVec, tempQuaternion, tempScaleVec)
        const position = tempPositionVec.toArray()
        const scale = tempScaleVec.toArray()
        tempEuler.setFromQuaternion(tempQuaternion)
        const rotation = [
          tempEuler.x,
          tempEuler.y,
          tempEuler.z,
        ] satisfies Number3Tuple

        const itemType = item.name.split('[')[0] // block_type[some_blockstate=value,another_blockstate=value2]
        const extraDataList = item.name
          .slice(itemType.length + 1, -1)
          .split(',')
        const extraData: Record<string, string> = extraDataList.reduce(
          (acc, cur) => {
            const [k, v] = cur.split('=')
            // blockstate가 없을 경우 empty string을 key로 사용하게 되어 들어가게 되므로 빼주기
            if (k.length < 1) return acc
            return { ...acc, [k]: v }
          },
          {},
        )

        if ('isCollection' in item && item.isCollection) {
          // group

          const children = item.children ?? []
          const childrenIds = await f(children, id)

          entities.set(id, {
            kind: 'group',
            id,
            position,
            rotation,
            size: scale,
            children: childrenIds.filter((id) => id != null),
            parent: parentEntityId,
            name: item.name,
          })
        } else if ('isBlockDisplay' in item && item.isBlockDisplay) {
          // block display

          entities.set(id, {
            kind: 'block',
            id,
            type: itemType,
            position,
            rotation,
            size: scale,
            parent: parentEntityId,
            blockstates: extraData,
            display: extraData['display'] as ModelDisplayPositionKey,
          })
        } else if ('isItemDisplay' in item && item.isItemDisplay) {
          // item display

          entities.set(id, {
            kind: 'item',
            id,
            type: itemType,
            position,
            rotation,
            size: scale,
            parent: parentEntityId,
            display: extraData['display'] as ModelDisplayPositionKey,
          })

          const entity = entities.get(id)!
          if (isItemDisplayPlayerHead(entity)) {
            let textureUrl: string | undefined
            if (item.defaultTextureValue != null) {
              const decodedTextureValue = JSON.parse(
                atob(item.defaultTextureValue),
              ) as TextureValue
              textureUrl = decodedTextureValue.textures.SKIN?.url
            }

            let paintTexturePixels: number[] = []
            if (item.paintTexture != null) {
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d')!
              // we need to load image asynconously to ensure image data is fully loaded before processing
              const image = await new Promise<HTMLImageElement>((resolve) => {
                const img = new Image()
                img.onload = () => resolve(img)
                img.src = item.paintTexture!
              })

              ctx.drawImage(image, 0, 0, 64, 64)
              const imageData = ctx.getImageData(0, 0, 64, 64)
              paintTexturePixels = Array.from(imageData.data)
            }

            // `paintTexture` (unbaked status) takes priority when both `paintTexture` and `defaultTextureValue` set.
            entity.playerHeadProperties = {
              texture:
                item.paintTexture != null
                  ? {
                      baked: false,
                      paintTexturePixels,
                    }
                  : textureUrl != null
                    ? {
                        baked: true,
                        url: textureUrl,
                      }
                    : null,
            }
          }
        } else if ('isTextDisplay' in item && item.isTextDisplay) {
          // text display

          const textColorRGB = parseInt(item.options.color.slice(1), 16)
          const backgroundColorRGB = parseInt(
            item.options.backgroundColor.slice(1),
            16,
          )
          const backgroundColorARGB =
            (((item.options.backgroundColorAlpha * 255) << 24) |
              backgroundColorRGB) >>>
            0

          entities.set(id, {
            kind: 'text',
            id,
            position,
            rotation,
            size: scale,
            parent: parentEntityId,

            text: item.name,
            textColor: textColorRGB,
            textEffects: {
              bold: item.options.bold,
              italic: item.options.italic,
              underlined: item.options.underline,
              strikethrough: item.options.strikeThrough,
              obfuscated: item.options.obfuscated,
            },
            alignment: item.options.align,
            backgroundColor: backgroundColorARGB,
            defaultBackground: false,
            lineWidth: item.options.lineLength,
            seeThrough: false,
            shadow: false,
            textOpacity: item.options.alpha * 255,
          })
        } else {
          return null
        }

        return id
      }),
    )
  }

  // saveData[0]이 최상단 그룹으로 확인되어 이거만 처리함
  await f(saveData[0].children)

  return entities
}
