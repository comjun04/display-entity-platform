import type { LineSegmentsProps } from '@react-three/fiber'
import { forwardRef } from 'react'
import { LineSegments } from 'three'

const INDICATOR_HEIGHT = 0.006

const INDICATOR_VERTICES = new Float32Array([
  // Chevron, pointing toward -Z (north)
  -0.3,
  INDICATOR_HEIGHT,
  -0.1,
  0,
  INDICATOR_HEIGHT,
  -0.38,

  0,
  INDICATOR_HEIGHT,
  -0.38,
  0.3,
  INDICATOR_HEIGHT,
  -0.1,

  // 'N' label
  -0.175,
  INDICATOR_HEIGHT,
  0.37,
  -0.175,
  INDICATOR_HEIGHT,
  -0.05,

  -0.175,
  INDICATOR_HEIGHT,
  -0.05,
  0.175,
  INDICATOR_HEIGHT,
  0.37,

  0.175,
  INDICATOR_HEIGHT,
  0.37,
  0.175,
  INDICATOR_HEIGHT,
  -0.05,
])

const NorthIndicator = forwardRef<LineSegments, LineSegmentsProps>(
  (props, ref) => {
    return (
      <lineSegments ref={ref} renderOrder={1} raycast={() => null} {...props}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[INDICATOR_VERTICES, 3]}
          ></bufferAttribute>
        </bufferGeometry>
        <lineBasicMaterial color={0x606060} depthWrite={false} />
      </lineSegments>
    )
  },
)
NorthIndicator.displayName = 'NorthIndicator'

export default NorthIndicator
