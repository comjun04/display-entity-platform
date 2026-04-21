import { type ThreeEvent, invalidate } from '@react-three/fiber'
import { type FC, type MutableRefObject, useEffect, useRef } from 'react'
import { Group } from 'three'
import { useShallow } from 'zustand/shallow'

import { createTextMesh } from '@/lib/resources/textMesh'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import type { Number3Tuple } from '@/types/base'

import { BoundingBox } from './BoundingBox'

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

  const innerGroupRef = useRef<Group>(null)
  const textModelGroupRef = useRef<Group>()

  useEffect(() => {
    const asyncFn = async () => {
      if (
        innerGroupRef.current == null ||
        thisEntityLineWidth == null ||
        thisEntityBackgroundColor == null
      ) {
        return
      }

      const textModelGroup = await createTextMesh({
        text,
        font: forceUnifont ? 'uniform' : 'default',
        lineWidth: thisEntityLineWidth,
        backgroundColor: thisEntityBackgroundColor ?? 0xff000000,
        textColor: thisEntityTextColor ?? 0xffffffff,
      })

      if (textModelGroupRef.current != null) {
        innerGroupRef.current.remove(textModelGroupRef.current)
      }
      innerGroupRef.current.add(textModelGroup)
      textModelGroupRef.current = textModelGroup

      invalidate()
    }

    asyncFn().catch(console.error)
  }, [
    id,
    text,
    thisEntityLineWidth,
    thisEntityBackgroundColor,
    thisEntityTextColor,
    forceUnifont,
    targetGameVersion,
  ])

  return (
    <object3D ref={ref}>
      <BoundingBox
        object={ref?.current}
        visible={thisEntitySelected}
        color="#fb2c36"
      />

      <group onClick={onClick} ref={innerGroupRef} />
    </object3D>
  )
}

export default TextDisplay
