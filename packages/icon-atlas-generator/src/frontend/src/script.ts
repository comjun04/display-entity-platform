import {
  AmbientLight,
  DirectionalLight,
  Euler,
  Group,
  MathUtils,
  Matrix4,
  Mesh,
  Scene,
  WebGLRenderer,
} from 'three'
import type {
  APIGetJobsResponse,
  APISubmitJobsBody,
  APISubmitJobsResponse,
} from '../../types'
import { loadModel } from './resources/model'
import { AssetFileInfosCache } from './resources/assetFileInfo'
import { generateModelMeshIngredients } from './resources/modelMesh'
import {
  calculateDefaultBlockstates,
  getMatchingBlockstateModel,
  loadBlockstates,
} from './resources/blockstates'
import { getTextureColor, stripMinecraftPrefix } from './utils'
import { IsometricCamera } from './IsometricCamera'
import { loadTextureImage } from './resources/material'

const SIZE = 64

// initialize icon atlas canvas
const atlasCanvas = document.createElement('canvas')
atlasCanvas.style.imageRendering = 'pixelated' // show accurate pixels on canvas
document.body.appendChild(atlasCanvas)

const atlasCanvasCtx = atlasCanvas.getContext('2d')!

// initialize three.js
const scene = new Scene()

// setup camera
const isometricCamera = new IsometricCamera()
scene.add(isometricCamera)
isometricCamera.position
  .set(1, 426.05 / 512, 1)
  .normalize()
  .multiplyScalar(10)
isometricCamera.lookAt(0, 0, 0)
isometricCamera.updateMatrixWorld(true)
isometricCamera.updateFrustum()

// add light
const directionLight1 = new DirectionalLight()
directionLight1.position.set(0, 10, 6)
const directionLight2 = new DirectionalLight()
directionLight2.position.set(0, 10, -6)

scene.add(new AmbientLight(0xffffff, 1.7), directionLight1, directionLight2)

// add group where entity models will be put
const group = new Group()
group.position.setScalar(-0.5)
scene.add(group)

// set up renderer
const renderer = new WebGLRenderer({
  alpha: true, // enable transparent background
})
renderer.setSize(SIZE, SIZE)
document.body.appendChild(renderer.domElement)

// start!
async function run() {
  const { jobs, targetGameVersion } = (await fetch(
    `${import.meta.env.VITE_DEV_HOST}/api/jobs`,
  ).then((res) => res.json())) as APIGetJobsResponse

  AssetFileInfosCache.instance.targetGameVersion = targetGameVersion

  // atlas image 가로 세로 정사각형 크기
  const sq = Math.ceil(Math.sqrt(jobs.length))
  atlasCanvas.width = sq * SIZE
  atlasCanvas.height = sq * SIZE

  console.log(`total jobs: ${jobs.length}, image size: ${sq}x${sq}`)

  let i = 0
  for (const job of jobs) {
    const xOffset = i % sq
    const yOffset = Math.floor(i / sq)

    // TODO: create mesh, render, copy image data to larger atlas canvas

    // clear previous job
    group.clear()

    try {
      // first load as icon
      const resourceLocation = `item/${job.id}`
      const { data: modelData, isBlockShapedItemModel } =
        await loadModel(resourceLocation)

      if (isBlockShapedItemModel) {
        // load as block model
        const blockstatesData = await loadBlockstates(job.id)
        const matchingBlockstateModels = getMatchingBlockstateModel(
          blockstatesData,
          calculateDefaultBlockstates(
            job.id,
            blockstatesData,
            job.defaultBlockstates,
          ),
        )

        const models = await Promise.all(
          matchingBlockstateModels.map((d) => createModel(d.model, d.x, d.y)),
        )

        // prevent error when `models` is empty array
        if (models.length > 0) {
          group.add(...models)
        }

        renderer.render(scene, isometricCamera)
        copyCanvasToAtlas(xOffset, yOffset)
      } else {
        const sortedTextures = Object.keys(modelData.textures)
          .filter((key) => /^layer\d+$/g.test(key))
          .sort((a, b) => {
            const numA = parseInt(a.slice(5))
            const numB = parseInt(b.slice(5))
            return numA - numB
          })
          .map((key) => ({
            layer: key.slice(5),
            texture: modelData.textures[key],
          }))
        const data = await Promise.all(
          sortedTextures.map(async ({ layer, texture }) => {
            const textureResourceLocation = stripMinecraftPrefix(
              typeof texture === 'string' ? texture : texture.sprite,
            )
            const { dataUrl } = await loadTextureImage({
              type: 'vanilla',
              resourceLocation: textureResourceLocation,
            })
            const image = new Image()
            await new Promise((resolve) => {
              image.onload = resolve
              image.src = dataUrl
            })

            const textureColor = getTextureColor(
              resourceLocation,
              targetGameVersion,
              layer,
            )

            return { image, textureColor: textureColor }
          }),
        )
        copyStackedImagesToAtlas(data, xOffset, yOffset)
      }
    } catch (err) {
      console.error(`Unexpected error when processing ${job.id}:`, err)
    }

    i++
  }

  console.log('submitting...')

  // submit to server
  const encodedImage = atlasCanvas.toDataURL()
  const submitResult = (await fetch(
    `${import.meta.env.VITE_DEV_HOST}/api/submit`,
    {
      method: 'POST',
      body: JSON.stringify({
        atlasImage: encodedImage,
        iconSize: SIZE,
      } satisfies APISubmitJobsBody),
    },
  ).then((res) => res.json())) as APISubmitJobsResponse
  if (submitResult.result === 'success') {
    console.log('end!')
    window.close() // just close it
  }
}
run().catch(console.error)

const HalfBlockTranslatedMatrix = new Matrix4().makeTranslation(0.5, 0.5, 0.5)
const ReverseHalfBlockTranslatedMatrix = new Matrix4().makeTranslation(
  -0.5,
  -0.5,
  -0.5,
)

async function createModel(
  resourceLocation: string,
  xRotation = 0,
  yRotation = 0,
) {
  const { data: modelData, isBlockShapedItemModel } =
    await loadModel(resourceLocation)

  const isItemModel = stripMinecraftPrefix(resourceLocation).startsWith('item/')
  const meshIngredients = await generateModelMeshIngredients({
    modelResourceLocation: resourceLocation,
    elements: modelData.elements,
    textures: modelData.textures,
    isItemModel,
    isBlockShapedItemModel,
    playerHeadData: undefined,
  })
  if (meshIngredients == null) {
    throw new Error(`Failed to load model mesh data for ${resourceLocation}`)
  }

  const mesh = new Mesh(meshIngredients.geometry, meshIngredients.materials)
  mesh.matrixAutoUpdate = false
  mesh.matrix
    .identity()
    .premultiply(ReverseHalfBlockTranslatedMatrix)
    .premultiply(
      new Matrix4().makeRotationFromEuler(
        new Euler(
          MathUtils.degToRad(-1 * xRotation),
          MathUtils.degToRad(-1 * yRotation),
          0,
          'YXZ',
        ),
      ),
    )
    .premultiply(HalfBlockTranslatedMatrix)

  return mesh
}

const buf = new Uint8Array(SIZE * SIZE * 4)
const imageData = atlasCanvasCtx?.createImageData(SIZE, SIZE)
function copyCanvasToAtlas(xOffset: number, yOffset: number) {
  const width = SIZE
  const height = SIZE
  const gl = renderer.getContext()

  gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, buf)

  for (let y = 0; y < SIZE; y++) {
    const src = y * width * 4
    const dst = (height - y - 1) * width * 4

    imageData.data.set(buf.subarray(src, src + SIZE * 4), dst)
  }

  atlasCanvasCtx.putImageData(imageData, xOffset * width, yOffset * height)
}

const _stackedImageCanvas = new OffscreenCanvas(SIZE, SIZE)
const _stackedImageCanvasCtx = _stackedImageCanvas.getContext('2d')!
const _stackedImageLayer = new OffscreenCanvas(SIZE, SIZE)
const _stackedImageLayerCtx = _stackedImageLayer.getContext('2d')!
function copyStackedImagesToAtlas(
  data: {
    image: HTMLImageElement
    textureColor: number
  }[],
  xOffset: number,
  yOffset: number,
) {
  const width = SIZE
  const height = SIZE

  for (const { image, textureColor: tintColor } of data) {
    // reset
    _stackedImageLayerCtx.clearRect(0, 0, width, height)

    // set this immediately before drawing image to ensure smoothing is disabled
    _stackedImageLayerCtx.imageSmoothingEnabled = false
    _stackedImageLayerCtx.drawImage(image, 0, 0, width, height)

    // skip tinting unless the color is not white
    if (tintColor !== 0xffffff) {
      const tr = (tintColor >>> 16) & 0xff
      const tg = (tintColor >>> 8) & 0xff
      const tb = tintColor & 0xff

      const imageData = _stackedImageLayerCtx.getImageData(0, 0, 64, 64)
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] *= tr / 0xff
        imageData.data[i + 1] *= tg / 0xff
        imageData.data[i + 2] *= tb / 0xff
      }
      _stackedImageLayerCtx.putImageData(imageData, 0, 0)
    }

    _stackedImageCanvasCtx.drawImage(_stackedImageLayer, 0, 0)
  }

  atlasCanvasCtx.drawImage(
    _stackedImageCanvas,
    xOffset * width,
    yOffset * height,
    width,
    height,
  )

  // reset
  _stackedImageCanvasCtx.clearRect(0, 0, width, height)
}
