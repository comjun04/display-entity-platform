import { type ThreeEvent, extend, invalidate } from '@react-three/fiber'
import { type FC, type MutableRefObject, useEffect, useRef } from 'react'
import { Group } from 'three'
import { useShallow } from 'zustand/shallow'

import { TextMeshGroup } from '@/lib/resources/textMesh'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import type { Number3Tuple } from '@/types/base'

import { BoundingBox } from './BoundingBox'

extend({ TextMeshGroup })

type TextDisplayProps = {
  id: string
  text: string
  position: Number3Tuple
  rotation: Number3Tuple
  size: Number3Tuple
  onClick?: (event: ThreeEvent<MouseEvent>) => void
  objectRef?: MutableRefObject<Group>
}

const TextDisplay: FC<TextDisplayProps> = ({
  id,
  text,
  // position,
  // rotation,
  // size,
  objectRef: ref,
  onClick,
}) => {
  const {
    thisEntityLineWidth,
    thisEntityTextColor,
    thisEntityBackgroundColor,
    thisEntitySelected,
  } = useDisplayEntityStore(
    useShallow((state) => {
      const thisEntity = state.entities.get(id)
      return {
        thisEntityLineWidth:
          thisEntity?.kind === 'text' ? thisEntity.lineWidth : undefined,
        thisEntityTextColor:
          thisEntity?.kind === 'text' ? thisEntity.textColor : undefined,
        thisEntityBackgroundColor:
          thisEntity?.kind === 'text' ? thisEntity.backgroundColor : undefined,
        thisEntitySelected: state.selectedEntityIds.includes(id),
      }
    }),
  )
  const forceUnifont = useEditorStore(
    (state) => state.settings.general.forceUnifont,
  )

  const targetGameVersion = useProjectStore((state) => state.targetGameVersion)

  const textMeshGroupRef = useRef<TextMeshGroup>(null)
  useEffect(() => {
    const asyncFn = async () => {
      if (thisEntityLineWidth == null || thisEntityBackgroundColor == null) {
        return
      }

      await textMeshGroupRef.current?.updateData({
        text,
        font: forceUnifont ? 'uniform' : 'default',
        lineWidth: thisEntityLineWidth,
        backgroundColor: thisEntityBackgroundColor ?? 0xff000000,
        textColor: thisEntityTextColor ?? 0xffffffff,
      })

      invalidate()
    }

    asyncFn().catch(console.error)
  }, [
    id,
    text,
    forceUnifont,
    thisEntityLineWidth,
    thisEntityTextColor,
    thisEntityBackgroundColor,
    targetGameVersion,
  ])

  return (
    <object3D ref={ref} name={`TextDisplay ${id}`} matrixAutoUpdate={false}>
      <BoundingBox
        object={ref?.current}
        visible={thisEntitySelected}
        color="#fb2c36"
      />

      <group onClick={onClick} matrixAutoUpdate={false}>
        <textMeshGroup ref={textMeshGroupRef} />
      </group>
    </object3D>
  )
}

export default TextDisplay
