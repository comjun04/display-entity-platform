import {
  BufferAttribute,
  BufferGeometry,
  type GeometryGroup,
  Material,
  MathUtils,
  PlaneGeometry,
  Vector3,
} from 'three'
import { mergeBufferGeometries, mergeVertices } from 'three-stdlib'

import { isValidTextureUrl, stripMinecraftPrefix } from '@/lib/utils'
import type {
  ModelElement,
  ModelFaceKey,
  Number3Tuple,
  PlayerHeadProperties,
} from '@/types/base'

import { getLogger } from '../logger'
import { loadMaterial } from './material'

const logger = getLogger('ResourceLoader/modelMesh')

const getTextureResourceLocation = (
  textureResourceLocationMap: Record<string, string>,
  key: string,
) => {
  if (key.startsWith('#'))
    return getTextureResourceLocation(textureResourceLocationMap, key.slice(1))

  if (!(key in textureResourceLocationMap)) return

  if (textureResourceLocationMap[key].startsWith('#'))
    return getTextureResourceLocation(
      textureResourceLocationMap,
      textureResourceLocationMap[key].slice(1),
    )
  else return stripMinecraftPrefix(textureResourceLocationMap[key])
}

export type LoadModelMaterialsArgs = {
  modelResourceLocation: string
  elements: ModelElement[]
  textures: Record<string, string>
  isItemModel: boolean
  playerHeadData?: {
    textureData: NonNullable<PlayerHeadProperties['texture']>
    showSecondLayer: boolean
  }
}

/**
 * model에 포함된 texture들이 매핑된 material들을 로딩합니다.
 * material이 캐싱되어 있으면 그냥 넘기고 아니면 material를 생성 후 캐싱합니다.
 *
 * 별도의 리턴값은 없습니다.
 */
export async function loadModelMaterials({
  modelResourceLocation,
  elements,
  textures,
  isItemModel,
  playerHeadData,
}: LoadModelMaterialsArgs) {
  // player_head check
  const isPlayerHead = modelResourceLocation === 'item/player_head'

  for (const element of elements) {
    for (const faceKey in element.faces) {
      const face = faceKey as ModelFaceKey
      const faceData = element.faces[face]!
      const textureResourceLocation = getTextureResourceLocation(
        textures,
        faceData.texture,
      )
      if (textureResourceLocation == null) {
        logger.warn(
          `Cannot extract texture resource location from model face data. model: ${modelResourceLocation}, faceKey: ${faceKey}`,
        )
        return
      }

      const textureLayer =
        isItemModel && /^#layer\d{1,}$/.test(faceData.texture)
          ? faceData.texture.slice(6)
          : undefined

      await loadMaterial({
        textureData: isPlayerHead
          ? playerHeadData?.textureData.baked &&
            isValidTextureUrl(playerHeadData.textureData.url)
            ? {
                // baked texture url
                type: 'player_head',
                playerHead: {
                  baked: true,
                  url: playerHeadData.textureData.url,
                  showSecondLayer: playerHeadData.showSecondLayer,
                },
              }
            : playerHeadData?.textureData.baked === false
              ? {
                  // unbaked texture data url
                  type: 'player_head',
                  playerHead: {
                    baked: false,
                    paintTexturePixels:
                      playerHeadData.textureData.paintTexturePixels,
                    showSecondLayer: playerHeadData.showSecondLayer,
                  },
                }
              : {
                  // fallback
                  type: 'vanilla',
                  resourceLocation: 'entity/player/slim/steve',
                }
          : {
              // not player_head
              type: 'vanilla',
              resourceLocation: textureResourceLocation,
            },
        modelResourceLocation,
        textureLayer,
        tintindex: faceData.tintindex,
      })
    }
  }
}

export type LoadModelMeshArgs = {
  modelResourceLocation: string
  elements: ModelElement[]
  textures: Record<string, string>
  isItemModel: boolean
  isBlockShapedItemModel: boolean
  playerHeadData?: {
    textureData: NonNullable<PlayerHeadProperties['texture']>
    showSecondLayer: boolean
  }
}
export async function generateModelMeshIngredients({
  modelResourceLocation,
  elements,
  textures,
  isItemModel,
  isBlockShapedItemModel,
  playerHeadData,
}: LoadModelMeshArgs) {
  const mergedGeometries: BufferGeometry[] = []
  const fullGeometryGroups: GeometryGroup[] = []
  const fullMaterials: {
    material: Material
    materialKey: string
  }[] = []

  // player_head check
  const isPlayerHead = modelResourceLocation === 'item/player_head'

  let elementIdx = 0
  for (const element of elements) {
    const fromVec = new Vector3(...element.from).divideScalar(16)
    const toVec = new Vector3(...element.to).divideScalar(16)
    const centerVec = new Vector3().addVectors(fromVec, toVec).divideScalar(2)
    const sizeVec = new Vector3().add(toVec).sub(fromVec)

    const elementFrom = element.from
    const elementTo = element.to
    const elementSize = sizeVec.toArray()

    const geometries: PlaneGeometry[] = []
    const geometryGroups: GeometryGroup[] = []

    let faceIdx = 0
    for (const faceKey in element.faces) {
      const face = faceKey as ModelFaceKey
      const faceData = element.faces[face]!
      const textureResourceLocation = getTextureResourceLocation(
        textures,
        faceData.texture,
      )
      if (textureResourceLocation == null) {
        logger.warn(
          `Cannot extract texture resource location from model face data. model: ${modelResourceLocation}, faceKey: ${faceKey}`,
        )
        return
      }

      const textureLayer =
        isItemModel && /^#layer\d{1,}$/.test(faceData.texture)
          ? faceData.texture.slice(6)
          : undefined

      // BlockFace.tsx

      const { material, materialKey } = await loadMaterial({
        textureData: isPlayerHead
          ? playerHeadData?.textureData.baked === true &&
            isValidTextureUrl(playerHeadData.textureData.url)
            ? {
                // baked texture url
                type: 'player_head',
                playerHead: {
                  baked: true,
                  url: playerHeadData.textureData.url,
                  showSecondLayer: playerHeadData.showSecondLayer,
                },
              }
            : playerHeadData?.textureData.baked === false
              ? {
                  // unbaked texture data url
                  type: 'player_head',
                  playerHead: {
                    baked: false,
                    paintTexturePixels:
                      playerHeadData.textureData.paintTexturePixels,
                    showSecondLayer: playerHeadData.showSecondLayer,
                  },
                }
              : {
                  // fallback
                  type: 'vanilla',
                  resourceLocation: 'entity/player/slim/steve',
                }
          : {
              // not player_head
              type: 'vanilla',
              resourceLocation: textureResourceLocation,
            },
        modelResourceLocation,
        textureLayer,
        tintindex: faceData.tintindex,
      })

      let materialIndex = fullMaterials.findIndex(
        (d) => d.materialKey === materialKey,
      )
      if (materialIndex < 0) {
        fullMaterials.push({ material, materialKey })
        materialIndex = fullMaterials.length - 1
      }

      let width = 1
      let height = 1

      let meshPosition: Number3Tuple = [0, 0, 0]
      let meshRotation: Number3Tuple = [0, 0, 0]
      const deg90 = MathUtils.degToRad(90)

      switch (face) {
        case 'up':
          width = elementSize[0]
          height = elementSize[2]
          meshPosition = [0, elementSize[1] / 2, 0]
          meshRotation = [-deg90, 0, 0]
          break
        case 'down':
          width = elementSize[0]
          height = elementSize[2]
          meshPosition = [0, -elementSize[1] / 2, 0]
          meshRotation = [deg90, 0, 0]
          break
        case 'north':
          width = elementSize[0]
          height = elementSize[1]
          meshPosition = [0, 0, -elementSize[2] / 2]
          meshRotation = [0, 2 * deg90, 0]
          break
        case 'south': // base
          width = elementSize[0]
          height = elementSize[1]
          meshPosition = [0, 0, elementSize[2] / 2]
          meshRotation = [0, 0, 0]
          break
        case 'west':
          width = elementSize[2]
          height = elementSize[1]
          meshPosition = [-elementSize[0] / 2, 0, 0]
          meshRotation = [0, -deg90, 0]
          break
        case 'east':
          width = elementSize[2]
          height = elementSize[1]
          meshPosition = [elementSize[0] / 2, 0, 0]
          meshRotation = [0, deg90, 0]
          break
      }

      const geometry = new PlaneGeometry(width, height)
      geometry.rotateX(meshRotation[0])
      geometry.rotateY(meshRotation[1])
      geometry.rotateZ(meshRotation[2])
      geometry.translate(...meshPosition)

      let uv = faceData.uv
      if (uv == null) {
        switch (face) {
          case 'up':
          case 'down':
            uv = [elementFrom[0], elementFrom[2], elementTo[0], elementTo[2]]
            break
          case 'north':
          case 'south': // base
            uv = [elementFrom[0], elementFrom[1], elementTo[0], elementTo[1]]
            break
          case 'west':
          case 'east':
            uv = [elementFrom[2], elementFrom[1], elementTo[2], elementTo[1]]
            break
        }
      } else {
        uv = [uv[0], 16 - uv[3], uv[2], 16 - uv[1]] // y좌표 반전
      }

      // bottom-left first
      const [uvFrom, uvTo] = [
        [uv[0] / 16, uv[1] / 16],
        [uv[2] / 16, uv[3] / 16],
      ] as const

      const vertexUVTopLeft = [uvFrom[0], uvTo[1]]
      const vertexUVTopRight = [uvTo[0], uvTo[1]]
      const vertexUVBottomLeft = [uvFrom[0], uvFrom[1]]
      const vertexUVBottomRight = [uvTo[0], uvFrom[1]]

      let vertexUV = vertexUVTopLeft.concat(
        vertexUVTopRight,
        vertexUVBottomLeft,
        vertexUVBottomRight,
      )
      switch (faceData.rotation) {
        case 90:
          vertexUV = vertexUVBottomLeft.concat(
            vertexUVTopLeft,
            vertexUVBottomRight,
            vertexUVTopRight,
          )
          break
        case 180:
          vertexUV = vertexUVBottomRight.concat(
            vertexUVBottomLeft,
            vertexUVTopRight,
            vertexUVTopLeft,
          )
          break
        case 270:
          vertexUV = vertexUVTopRight.concat(
            vertexUVBottomRight,
            vertexUVTopLeft,
            vertexUVBottomLeft,
          )
          break
      }

      // three.js는 bottom left, bottom right, top left, top right 순으로 uv값을 받지만
      // 보통의 텍스쳐 이미지는 top left가 기준점이기 때문에 상하로 뒤집어줘야 방향이 맞음
      // top left, top right, bottom left, bottom right
      // const f = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0])
      const vertexUVArr = new Float32Array(vertexUV)

      const uvAttribute = new BufferAttribute(vertexUVArr, 2)
      geometry.setAttribute('uv', uvAttribute)

      geometries.push(geometry)

      geometryGroups.push({
        start: fullGeometryGroups.length * 6 + faceIdx * 6,
        count: 6, // PlaneGeometry = 2 triangles * 3 indices = 6
        materialIndex,
      })

      faceIdx++
    }

    const mergedGeometry = mergeBufferGeometries(geometries, false)
    if (mergedGeometry == null) {
      logger.error(
        `Cannot merge model geometries for element ${elementIdx} of model ${modelResourceLocation}`,
      )
      continue
    }

    // element rotation
    let rotation = [0, 0, 0] satisfies Number3Tuple
    let groupScale = [1, 1, 1] satisfies Number3Tuple
    if (element.rotation != null) {
      const rad = MathUtils.degToRad(element.rotation.angle)

      switch (element.rotation.axis) {
        case 'x':
          rotation = [rad, 0, 0]
          break
        case 'y':
          rotation = [0, rad, 0]
          break
        case 'z':
          rotation = [0, 0, rad]
          break
      }

      if (element.rotation.rescale) {
        const scaleBy = 1 / Math.cos(rad)
        switch (element.rotation.axis) {
          case 'x':
            groupScale = [1, scaleBy, scaleBy]
            break
          case 'y':
            groupScale = [scaleBy, 1, scaleBy]
            break
          case 'z':
            groupScale = [scaleBy, scaleBy, 1]
            break
        }
      }
    }

    // 회전 중심 위치
    const rotationOriginVec = new Vector3(
      ...(element.rotation?.origin ?? ([0, 0, 0] as const)),
    ).divideScalar(16)

    const vec1 = centerVec.clone().sub(rotationOriginVec)
    const vec2 = rotationOriginVec
      .clone()
      .subScalar(isBlockShapedItemModel ? 0.5 : 0)

    // rotation origin 적용할 때
    // 1. centerVec - rotationOriginVec 위치로 이동 => 회전 중심위치가 (0,0,0)에 위치하도록 함
    // 2. 부모 group에서 rotation을 적용하고 원래 위치로 다시 움직임 (centerVec - rotationOriginVec + rotationOriginVec = centerVec)
    mergedGeometry
      .translate(...vec1.toArray())
      .scale(...groupScale)
      .rotateX(rotation[0])
      .rotateY(rotation[1])
      .rotateZ(rotation[2])
      .translate(...vec2.toArray())

    mergedGeometries.push(mergeVertices(mergedGeometry))
    fullGeometryGroups.push(...geometryGroups)

    elementIdx++
  }

  const finalMergedGeometry = mergeBufferGeometries(mergedGeometries, false)
  if (finalMergedGeometry == null) {
    logger.error(
      `Cannot merge model geometries for element ${elementIdx} of model ${modelResourceLocation}`,
    )
    return
  }

  if (fullMaterials.length > 1) {
    for (const group of fullGeometryGroups) {
      const { start, count, materialIndex } = group
      finalMergedGeometry.addGroup(start, count, materialIndex)
    }
  } else {
    // material이 1개일 때는 굳이 그룹을 여러 개로 나눌 필요가 없음 (그룹 1개당 1 draw call)
    // material이 2개 이상 사용될 때 geometry 합치는 순서를 조정해서 최소한의 그룹만 사용하도록 변경
    finalMergedGeometry.addGroup(0, fullGeometryGroups.length * 6, 0)
  }

  return {
    geometry: finalMergedGeometry,
    materials: fullMaterials.map((d) => d.material),
  }
}
