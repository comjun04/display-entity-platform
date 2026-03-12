import type { Node } from '@react-three/fiber'
import { Group } from 'three'

// A Group with zero scale on construction.
export class ZeroScaledGroup extends Group {
  constructor() {
    super()

    this.scale.setScalar(0)
    this.updateMatrix()
    this.updateMatrixWorld()
  }
}

// This should change when upgrading to r3f v9 (react v19), as global JSX namespace is deprecated
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      zeroScaledGroup: Node<ZeroScaledGroup, typeof ZeroScaledGroup>
    }
  }
}
