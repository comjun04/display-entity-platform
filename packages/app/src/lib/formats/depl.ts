import { nanoid } from 'nanoid'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'

import type {
  DisplayEntity,
  DisplayEntitySaveDataItem,
  Number3Tuple,
} from '@/types/base'
import { isItemDisplayPlayerHead } from '@/types/guards'

export function importDeplProjectFrom(items: DisplayEntitySaveDataItem[]) {
  const entities = new Map<string, DisplayEntity>()

  const tempMatrix4 = new Matrix4()
  const tempPositionVec = new Vector3()
  const tempScaleVec = new Vector3()
  const tempQuaternion = new Quaternion()
  const tempEuler = new Euler()

  const f: (
    itemList: DisplayEntitySaveDataItem[],
    parentEntityId?: string,
  ) => string[] = (itemList, parentEntityId) => {
    return itemList.map((item) => {
      const id = nanoid(16)

      tempMatrix4.fromArray(item.transforms)
      tempMatrix4.decompose(tempPositionVec, tempQuaternion, tempScaleVec)
      const position = tempPositionVec.toArray()
      const scale = tempScaleVec.toArray()
      tempEuler.setFromQuaternion(tempQuaternion)
      const rotation = [
        tempEuler.x,
        tempEuler.y,
        tempEuler.z,
      ] satisfies Number3Tuple

      // savedata v6 -> v7
      // set nbt value to empty string if not exist
      const nbt = item.nbt ?? ''

      if (item.kind === 'group') {
        const children = item.children ?? []
        const childrenIds = f(children, id)

        // savedata v4 -> v5
        // set group name to `Group` if not exist
        const groupName = item.name ?? 'Group'

        entities.set(id, {
          kind: 'group',
          id,
          position,
          rotation,
          size: scale,
          nbt,
          children: childrenIds,
          parent: parentEntityId,
          name: groupName,
        })
      } else if (item.kind === 'block') {
        // blockstate가 없을 경우 empty string을 key로 사용하게 되어 들어가게 되므로 빼주기
        const blockstatesCopy = Object.assign({}, item.blockstates)
        delete blockstatesCopy['']

        entities.set(id, {
          kind: 'block',
          id,
          type: item.type,
          position,
          rotation,
          size: scale,
          nbt,
          parent: parentEntityId,
          blockstates: item.blockstates,
          display: item.display,
        })
      } else if (item.kind === 'item') {
        entities.set(id, {
          kind: 'item',
          id,
          type: item.type,
          position,
          rotation,
          size: scale,
          nbt,
          parent: parentEntityId,
          display: item.display,
        })

        const entity = entities.get(id)!
        if (isItemDisplayPlayerHead(entity)) {
          if (item.playerHeadProperties != null) {
            // is player_head
            entity.playerHeadProperties = item.playerHeadProperties

            // savedata v5 -> v6
            const { texture: textureData } = entity.playerHeadProperties
            if (
              textureData?.baked === false &&
              textureData.paintTexturePixels == null
            ) {
              entity.playerHeadProperties.texture = null
            }
          } else {
            // savedata v1 -> v2
            // fill default playerHeadProperties if not exist
            entity.playerHeadProperties = {
              texture: null,
            }
          }
        }
      } else if (item.kind === 'text') {
        entities.set(id, {
          kind: 'text',
          id,
          position,
          rotation,
          size: scale,
          nbt,
          parent: parentEntityId,
          text: item.text,
          textColor: item.textColor,
          textEffects: item.textEffects,
          alignment: item.alignment,
          backgroundColor: item.backgroundColor,
          defaultBackground: item.defaultBackground,
          lineWidth: item.lineWidth,
          seeThrough: item.seeThrough,
          shadow: item.shadow,
          textOpacity: item.textOpacity,
        })
      }

      return id
    })
  }

  f(items)

  return entities
}
