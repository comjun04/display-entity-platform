import { Box3, OrthographicCamera, Vector3 } from 'three'

export class IsometricCamera extends OrthographicCamera {
  constructor() {
    super()
  }

  updateFrustum() {
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
      p.project(this)

      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
    const zoom = (maxY - minY) / 2

    this.left = -zoom
    this.right = zoom
    this.top = zoom
    this.bottom = -zoom
    this.updateProjectionMatrix()
  }
}
