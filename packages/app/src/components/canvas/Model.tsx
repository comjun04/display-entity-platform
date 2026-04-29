import { invalidate } from '@react-three/fiber'
import { type FC, useEffect, useRef, useState } from 'react'
import {
  DataTexture,
  Euler,
  MathUtils,
  Matrix4,
  Mesh,
  type MeshStandardMaterial,
  NearestFilter,
  Quaternion,
  Vector3,
} from 'three'

import useModelData from '@/hooks/useModelData'
import { getLogger } from '@/lib/logger'
import { makeMaterial } from '@/lib/resources/material'
import { generateModelMeshIngredients } from '@/lib/resources/modelMesh'
import { stripMinecraftPrefix } from '@/lib/utils'
import { useProjectStore } from '@/stores/projectStore'
import type {
  ModelDisplayPositionKey,
  Number3Tuple,
  PlayerHeadProperties,
} from '@/types/base'

type ModelNewProps = {
  initialResourceLocation: string
  displayType?: ModelDisplayPositionKey
  xRotation?: number
  yRotation?: number
  playerHeadData?: {
    textureData: NonNullable<PlayerHeadProperties['texture']>
    showSecondLayer: boolean
  }
}

const OriginVec = new Vector3()
const DisplayTranslationMinVec = new Vector3(-80, -80, -80)
const DisplayTranslationMaxVec = new Vector3(80, 80, 80)
const DisplayScaleMaxVec = new Vector3(4, 4, 4)

const HalfBlockTranslatedMatrix = new Matrix4().makeTranslation(0.5, 0.5, 0.5)
const ReverseHalfBlockTranslatedMatrix = new Matrix4().makeTranslation(
  -0.5,
  -0.5,
  -0.5,
)

const logger = getLogger('Model')

const Model: FC<ModelNewProps> = ({
  initialResourceLocation,
  displayType,
  xRotation = 0,
  yRotation = 0,
  playerHeadData,
}) => {
  const mergedMeshRef = useRef<Mesh>()
  const [meshLoaded, setMeshLoaded] = useState(false)

  const prevResourceLocationRef = useRef(initialResourceLocation)
  const prevPlayerHeadTextureDataRef = useRef(playerHeadData?.textureData)

  const targetGameVersion = useProjectStore((state) => state.targetGameVersion)

  const { data: modelDataTemp, loading: modelDataLoading } = useModelData(
    initialResourceLocation,
  )

  useEffect(() => {
    setMeshLoaded(false)
  }, [targetGameVersion])

  useEffect(() => {
    if (modelDataTemp == null || modelDataLoading) return

    const { data: modelData, isBlockShapedItemModel } = modelDataTemp
    const isItemModel = stripMinecraftPrefix(
      initialResourceLocation,
    ).startsWith('item/')

    const fn = async () => {
      // handle player_head related modification
      if (
        meshLoaded &&
        prevResourceLocationRef.current === initialResourceLocation &&
        initialResourceLocation === 'item/player_head'
      ) {
        /*
        console.log(
          'Attempting to process player_head instead of creating new mesh',
        )
        */

        const prevPlayerHeadTextureData = prevPlayerHeadTextureDataRef.current
        if (
          prevPlayerHeadTextureData?.baked === false &&
          playerHeadData?.textureData.baked === false
        ) {
          // prev and current has unbaked texture
          if (
            prevPlayerHeadTextureData?.paintTexturePixels !==
            playerHeadData?.textureData.paintTexturePixels
          ) {
            // unbaked texture has changed, update material texture
            // console.log('just update material texture')
            const newTexture = new DataTexture(
              new Uint8ClampedArray(
                playerHeadData?.textureData.paintTexturePixels,
              ),
              64,
              64,
            )
            newTexture.needsUpdate = true
            newTexture.flipY = true
            newTexture.magFilter = NearestFilter
            newTexture.colorSpace = 'srgb'

            const material = mergedMeshRef.current!.material as
              | MeshStandardMaterial
              | MeshStandardMaterial[] // Material | Material[]
            const materials = Array.isArray(material) ? material : [material]

            if (materials.length > 1) {
              logger.warn(
                'Detected multiple materials inside mesh. This is not intended',
              )
            }

            materials.forEach((material) => {
              const old = material.map
              material.map = newTexture
              old?.dispose()
            })
          }
        } else {
          // recreate material and attach
          // materials using unbaked playerHead texture are not cached,
          // so we should replace if changing unbaked one from or to baked one (baked playerHead texture or vanilla texture)
          // console.log('recreate material and attach')

          const newMaterial = await makeMaterial(
            playerHeadData != null
              ? {
                  type: 'player_head',
                  playerHead: playerHeadData.textureData.baked
                    ? {
                        baked: true,
                        url: playerHeadData.textureData.url,
                        showSecondLayer: playerHeadData.showSecondLayer,
                      }
                    : {
                        baked: false,
                        paintTexturePixels:
                          playerHeadData.textureData.paintTexturePixels,
                        showSecondLayer: playerHeadData.showSecondLayer,
                      },
                }
              : {
                  type: 'vanilla',
                  resourceLocation: 'entity/player/slim/steve',
                },
            0xffffff,
          )

          const old = mergedMeshRef.current!.material as
            | MeshStandardMaterial
            | MeshStandardMaterial[] // Material | Material[]
          mergedMeshRef.current!.material = newMaterial
          if (Array.isArray(old)) old.forEach((d) => d.dispose())
          else old?.dispose()
        }

        prevPlayerHeadTextureDataRef.current = playerHeadData?.textureData
        invalidate()
        return
      }

      if (meshLoaded) return

      setMeshLoaded(false)

      const meshIngredients = await generateModelMeshIngredients({
        modelResourceLocation: initialResourceLocation,
        elements: modelData.elements,
        textures: modelData.textures,
        isItemModel,
        isBlockShapedItemModel,
        playerHeadData,
      }).catch((err) => {
        logger.error(`Failed to load model mesh for ${initialResourceLocation}`)
        logger.error(err)
        return
      })
      if (meshIngredients == null) {
        return
      }

      const newMesh = new Mesh(
        meshIngredients.geometry,
        meshIngredients.materials,
      )

      if (mergedMeshRef.current != null) {
        mergedMeshRef.current.geometry.dispose()
      }
      mergedMeshRef.current = newMesh
      prevResourceLocationRef.current = initialResourceLocation
      prevPlayerHeadTextureDataRef.current = playerHeadData?.textureData

      setMeshLoaded(true)
    }

    fn().catch(logger.error)

    return () => {
      mergedMeshRef.current?.geometry.dispose()
    }
  }, [
    initialResourceLocation,
    modelDataTemp,
    modelDataLoading,
    meshLoaded,
    playerHeadData,
  ])

  useEffect(() => {
    const loadedMesh = mergedMeshRef.current
    if (loadedMesh == null) return

    if (modelDataTemp == null) return
    const { data: modelData } = modelDataTemp

    // display info
    const { display } = modelData
    const displayInfo = displayType != null ? (display[displayType] ?? {}) : {}
    const displayRotation = (displayInfo.rotation ?? [0, 0, 0]).map((d) =>
      MathUtils.degToRad(d),
    ) as Number3Tuple
    const displayTranslation = new Vector3(
      ...(displayInfo.translation ?? [0, 0, 0]),
    )
      .max(DisplayTranslationMinVec)
      .min(DisplayTranslationMaxVec)
      .divideScalar(16)
    const displayScale = new Vector3(...(displayInfo.scale ?? [1, 1, 1])).min(
      DisplayScaleMaxVec,
    )

    loadedMesh.matrixAutoUpdate = false
    loadedMesh.matrix
      .makeTranslation(displayTranslation) // set display translation first
      .premultiply(
        // set display rotation and scale
        new Matrix4().compose(
          OriginVec,
          new Quaternion().setFromEuler(new Euler(...displayRotation)),
          displayScale,
        ),
      )
      .premultiply(ReverseHalfBlockTranslatedMatrix)
      .premultiply(
        // set x rotation
        new Matrix4().makeRotationFromQuaternion(
          new Quaternion().setFromEuler(
            new Euler(MathUtils.degToRad(-xRotation), 0, 0),
          ),
        ),
      )
      .premultiply(
        // set y rotation
        new Matrix4().makeRotationFromQuaternion(
          new Quaternion().setFromEuler(
            new Euler(0, MathUtils.degToRad(-yRotation), 0),
          ),
        ),
      )
      .premultiply(HalfBlockTranslatedMatrix)
    loadedMesh.matrix.decompose(
      loadedMesh.position,
      loadedMesh.quaternion,
      loadedMesh.scale,
    )

    invalidate()
  }, [meshLoaded, modelDataTemp, displayType, xRotation, yRotation])

  useEffect(() => {
    if (meshLoaded) {
      invalidate()
    }
    invalidate()
  }, [meshLoaded])

  // ==========

  if (modelDataTemp == null) {
    return null
  }

  const { data: modelData } = modelDataTemp
  const { elements } = modelData

  // elements가 없을 경우 렌더링할 것이 없으므로 그냥 null을 리턴
  if (elements == null || elements.length < 1) {
    return null
  }

  if (!meshLoaded) return null

  return <primitive object={mergedMeshRef.current!} />
}

export default Model
