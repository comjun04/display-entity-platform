import {
  AmbientLight,
  Box3,
  BoxGeometry,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'

const SIZE = 300

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

// set up renderer
const renderer = new WebGLRenderer()
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
scene.add(mesh)
