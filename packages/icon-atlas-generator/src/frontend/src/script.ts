import {
  AmbientLight,
  Box3,
  BoxGeometry,
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { APIGetJobsResponse } from '../../types'
import { loadModel } from './resources/model'
import { AssetFileInfosCache } from './resources/assetFileInfo'
import { generateModelMeshIngredients } from './resources/modelMesh'
import {
  calculateDefaultBlockstates,
  getMatchingBlockstateModel,
  loadBlockstates,
} from './resources/blockstates'
import { stripMinecraftPrefix } from './utils'

const SIZE = 64

// initialize icon atlas canvas
const atlasCanvas = document.createElement('canvas')
// atlasCanvas.style.display = 'none'
document.body.appendChild(atlasCanvas)

const atlasCanvasCtx = atlasCanvas.getContext('2d')!

// initialize three.js
const scene = new Scene()

// setup camera
const camera = new OrthographicCamera()
scene.add(camera)

camera.position
  .set(-1, 426.05 / 512, 1)
  .normalize()
  .multiplyScalar(10)
camera.lookAt(0, 0, 0)
camera.updateMatrixWorld(true)
camera.updateProjectionMatrix()

// calculate camera zoom to make no gaps on top and bottom
const box3 = new Box3().setFromArray([0, 0, 0, 1, 1, 1])
const corners = [
  new Vector3(box3.min.x, box3.min.y, box3.min.z),
  new Vector3(box3.min.x, box3.min.y, box3.max.z),
  new Vector3(box3.min.x, box3.max.y, box3.min.z),
  new Vector3(box3.min.x, box3.max.y, box3.max.z),
  new Vector3(box3.max.x, box3.min.y, box3.min.z),
  new Vector3(box3.max.x, box3.min.y, box3.max.z),
  new Vector3(box3.max.x, box3.max.y, box3.min.z),
  new Vector3(box3.max.x, box3.max.y, box3.max.z),
]

let minY = Infinity
let maxY = -Infinity
for (const p of corners) {
  // World -> clip -> NDC
  p.project(camera)

  minY = Math.min(minY, p.y)
  maxY = Math.max(maxY, p.y)
}
const zoom = (maxY - minY) / 2

camera.left = -zoom
camera.right = zoom
camera.top = zoom
camera.bottom = -zoom
camera.updateProjectionMatrix()

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

// set the render loop
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera)
})

// test: cube
const mesh = new Mesh(
  new BoxGeometry(1, 1, 1),
  new MeshStandardMaterial({
    color: 'white',
  }),
)
// scene.add(mesh)

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

  let i = 0
  for (const job of jobs) {
    const xOffset = i % sq
    const yOffset = Math.floor(i / sq)

    // TODO: create mesh, render, copy image data to larger atlas canvas

    // clear previous job
    group.clear()

    if (job.kind === 'block') {
      const blockstatesData = await loadBlockstates(job.id)
      const matchingBlockstateModels = getMatchingBlockstateModel(
        blockstatesData,
        calculateDefaultBlockstates(blockstatesData, job.defaultBlockstates),
      )

      const models = await Promise.all(
        matchingBlockstateModels.map((d) => createModel(d.model, d.x, d.y)),
      )

      // prevent error when `models` is empty array
      if (models.length > 0) {
      group.add(...models)
      }
    } else if (job.kind === 'item') {
      const resourceLocation = `item/${job.id}`
      const model = await createModel(resourceLocation)
      group.add(model)
    }

    renderer.render(scene, camera)

    copyToAtlas(xOffset, yOffset)

    i++
  }
}
run().catch(console.error)

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

  mesh.rotation.set(
    MathUtils.degToRad(-1 * xRotation),
    MathUtils.degToRad(-1 * yRotation),
    0,
  )
  mesh.updateMatrix()

  return mesh
}

const buf = new Uint8Array(SIZE * SIZE * 4)
const imageData = atlasCanvasCtx?.createImageData(SIZE, SIZE)
function copyToAtlas(xOffset: number, yOffset: number) {
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
