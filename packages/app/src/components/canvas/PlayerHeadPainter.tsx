import { Grid } from '@react-three/drei'
import { type FC, useMemo } from 'react'
import { MathUtils } from 'three'

import { loadTextureImage } from '@/lib/resources/material'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { type HeadPainterLayer, useEditorStore } from '@/stores/editorStore'
import { useHistoryStore } from '@/stores/historyStore'
import type {
  ModelFaceKey,
  Number3Tuple,
  PlayerHeadProperties,
} from '@/types/base'

interface SideProps {
  face: ModelFaceKey
  layer: HeadPainterLayer
  handlePaint: (side: ModelFaceKey, x: number, y: number) => void
  handlePointerDown: (face: ModelFaceKey, x: number, y: number) => void
  handlePointerMove: (face: ModelFaceKey, x: number, y: number) => void
}
const Side: FC<SideProps> = ({
  face,
  layer,
  handlePaint,
  handlePointerDown,
  handlePointerMove,
}) => {
  const layerSize = layer === 'second' ? 0.53125 : 0.5
  const gridSize = useMemo(
    () => [layerSize, layerSize] satisfies [number, number],
    [layerSize],
  )
  const gridCellSize = layerSize / 8

  const groupPosition = useMemo<Number3Tuple>(() => {
    switch (face) {
      case 'up':
        return [0, (layerSize - 0.5) / 2 + 0.0001, 0]
      case 'down':
        return [0, -((layerSize + 0.5) / 2 + 0.0001), 0]
      case 'south':
        return [0, -0.25, -(layerSize / 2 + 0.0001)]
      case 'north':
        return [0, -0.25, layerSize / 2 + 0.0001]
      case 'east':
        return [layerSize / 2 + 0.0001, -0.25, 0]
      case 'west':
        return [-(layerSize / 2 + 0.0001), -0.25, 0]
    }
  }, [face, layerSize])
  const groupRotation = useMemo<Number3Tuple>(() => {
    switch (face) {
      case 'up':
        return [0, 0, 0]
      case 'down':
        return [MathUtils.degToRad(180), 0, 0]
      case 'south':
        return [MathUtils.degToRad(-90), 0, 0]
      case 'north':
        return [MathUtils.degToRad(90), 0, 0]
      case 'east':
        return [0, 0, MathUtils.degToRad(-90)]
      case 'west':
        return [0, 0, MathUtils.degToRad(90)]
    }
  }, [face])
  const innerMeshRotation = useMemo<Number3Tuple>(() => {
    switch (face) {
      case 'up':
      case 'down':
      case 'south':
        return [MathUtils.degToRad(-90), 0, MathUtils.degToRad(180)]
      case 'north':
        return [MathUtils.degToRad(-90), 0, MathUtils.degToRad(0)]
      case 'east':
        return [MathUtils.degToRad(-90), 0, MathUtils.degToRad(90)]
      case 'west':
        return [MathUtils.degToRad(-90), 0, MathUtils.degToRad(-90)]
    }
  }, [face])

  const getPixelIntegerPos = (pos: number) => {
    return Math.floor(((pos + layerSize / 2) / layerSize) * 8)
  }

  return (
    <group position={groupPosition} rotation={groupRotation}>
      <Grid
        args={gridSize}
        cellSize={gridCellSize}
        cellThickness={1}
        cellColor="#ffffff"
        sectionSize={0}
      />
      <mesh
        rotation={innerMeshRotation}
        onClick={(evt) => {
          const localPos = evt.object.worldToLocal(evt.point.clone())
          handlePaint(
            face,
            getPixelIntegerPos(localPos.x),
            getPixelIntegerPos(localPos.y),
          )
        }}
        onPointerDown={(evt) => {
          const localPos = evt.object.worldToLocal(evt.point.clone())
          handlePointerDown(
            face,
            getPixelIntegerPos(localPos.x),
            getPixelIntegerPos(localPos.y),
          )
        }}
        onPointerMove={(evt) => {
          const localPos = evt.object.worldToLocal(evt.point.clone())
          handlePointerMove(
            face,
            getPixelIntegerPos(localPos.x),
            getPixelIntegerPos(localPos.y),
          )
        }}
      >
        <planeGeometry args={gridSize} />
        <meshBasicMaterial transparent opacity={0} alphaTest={0.01} />
      </mesh>
    </group>
  )
}

type PlayerHeadPainterProps = {
  entityId: string
  playerHeadProperties: PlayerHeadProperties
}

const PlayerHeadPainter: FC<PlayerHeadPainterProps> = ({
  entityId,
  playerHeadProperties,
}) => {
  const headPainterLayer = useEditorStore((state) => state.headPainter.layer)

  const handlePaint = (side: ModelFaceKey, x: number, y: number) => {
    // console.log(side, x, y)

    const f = async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!

      const textureData = playerHeadProperties.texture

      if (textureData?.baked === false) {
        // load texture dataurl from properties obj, load it to canvas
        const imageData = new ImageData(64, 64)
        imageData.data.set(textureData.paintTexturePixels, 0)
        ctx.putImageData(imageData, 0, 0)
      } else {
        let image: HTMLImageElement
        if (textureData?.baked === true) {
          // load texture from cdn, and just load it to canvas
          ;({ image } = await loadTextureImage({
            type: 'player_head',
            playerHead: {
              baked: true,
              url: textureData.url,
              showSecondLayer: headPainterLayer === 'second',
            },
          })) // no resource fromVersion required on player_head
        } else {
          // load default steve texture to canvas
          ;({ image } = await loadTextureImage({
            type: 'vanilla',
            resourceLocation: 'entity/player/slim/steve',
          }))
        }

        // load it to canvas
        ctx.drawImage(image, 0, 0, 64, 16, 0, 0, 64, 16)
      }

      const {
        headPainter: { brushColor, layer },
      } = useEditorStore.getState()

      // draw
      let baseX: number
      let baseY: number
      switch (side) {
        case 'up':
          baseX = 8
          baseY = 0
          break

        case 'down':
          baseX = 16
          baseY = 0
          break

        case 'east':
          baseX = 0
          baseY = 8
          break

        case 'south':
          baseX = 8
          baseY = 8
          break

        case 'west':
          baseX = 16
          baseY = 8
          break

        case 'north':
          baseX = 24
          baseY = 8
          break
      }
      if (layer === 'second') {
        baseX += 32
      }

      const shouldFlipY = side !== 'down'
      const pixelX = baseX + x
      const pixelY = baseY + (shouldFlipY ? 7 - y : y)

      const brushColor_R = (brushColor >>> 16) & 0xff
      const brushColor_G = (brushColor >>> 8) & 0xff
      const brushColor_B = brushColor & 0xff
      const existingPixel = ctx.getImageData(pixelX, pixelY, 1, 1)
      if (
        existingPixel.data[0] === brushColor_R &&
        existingPixel.data[1] === brushColor_G &&
        existingPixel.data[2] === brushColor_B &&
        existingPixel.data[3] === 255
      ) {
        // console.log('no change needed')
        return
      }

      if (textureData?.baked === false) {
        useDisplayEntityStore
          .getState()
          .paintItemDisplayPlayerHeadTexture(
            entityId,
            brushColor,
            pixelX,
            pixelY,
          )
      } else {
        const imgData = ctx.createImageData(1, 1)
        imgData.data[0] = brushColor_R
        imgData.data[1] = brushColor_G
        imgData.data[2] = brushColor_B
        imgData.data[3] = 255

        ctx.putImageData(imgData, pixelX, pixelY)

        const finalImageData = ctx.getImageData(0, 0, 64, 64)

        useDisplayEntityStore
          .getState()
          .setItemDisplayPlayerHeadProperties(entityId, {
            texture: {
              baked: false,
              paintTexturePixels: Array.from(finalImageData.data),
            },
          })
      }
    }
    f().catch(console.error)
  }

  const handlePointerDown = (face: ModelFaceKey, x: number, y: number) => {
    useEditorStore.getState().headPainter.setNowPainting(true)
    useHistoryStore
      .getState()
      .playerHead.storeTextureDataBeforePaint(
        entityId,
        playerHeadProperties.texture,
      )

    handlePaint(face, x, y)
  }
  const handlePointerMove = (face: ModelFaceKey, x: number, y: number) => {
    // handlePaint() loads texture as image and processes it when not unbaked state
    // which lags if we call multiple times
    // since pointermove event can be called multiple times when mouse/touchpoint moves, so just block it
    if (playerHeadProperties.texture?.baked !== false) return

    const {
      headPainter: { nowPainting: headPainting },
    } = useEditorStore.getState()
    if (headPainting) {
      useHistoryStore
        .getState()
        .playerHead.storeTextureDataBeforePaint(
          entityId,
          playerHeadProperties.texture,
        )
      handlePaint(face, x, y)
    }
  }

  return (
    <>
      {/* top */}
      <Side
        face="up"
        layer={headPainterLayer}
        handlePaint={handlePaint}
        handlePointerDown={handlePointerDown}
        handlePointerMove={handlePointerMove}
      />

      {/* bottom */}
      <Side
        face="down"
        layer={headPainterLayer}
        handlePaint={handlePaint}
        handlePointerDown={handlePointerDown}
        handlePointerMove={handlePointerMove}
      />

      {/* front (south) */}
      <Side
        face="south"
        layer={headPainterLayer}
        handlePaint={handlePaint}
        handlePointerDown={handlePointerDown}
        handlePointerMove={handlePointerMove}
      />

      {/* back (north) */}
      <Side
        face="north"
        layer={headPainterLayer}
        handlePaint={handlePaint}
        handlePointerDown={handlePointerDown}
        handlePointerMove={handlePointerMove}
      />

      {/* east */}
      <Side
        face="east"
        layer={headPainterLayer}
        handlePaint={handlePaint}
        handlePointerDown={handlePointerDown}
        handlePointerMove={handlePointerMove}
      />

      {/* west */}
      <Side
        face="west"
        layer={headPainterLayer}
        handlePaint={handlePaint}
        handlePointerDown={handlePointerDown}
        handlePointerMove={handlePointerMove}
      />
    </>
  )
}

export default PlayerHeadPainter
