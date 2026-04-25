import { Helper } from '@react-three/drei'
import { type ThreeEvent, extend } from '@react-three/fiber'
import { type FC, type MutableRefObject, memo, useMemo, useRef } from 'react'
import { Group } from 'three'
import { BoxHelper } from 'three'
import { useShallow } from 'zustand/shallow'

import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import { type Number3Tuple } from '@/types/base'

import { BoundingBoxForInstanced } from './BoundingBox'
import Model from './Model'
import PlayerHeadPainter from './PlayerHeadPainter'
import { InstancedModel } from './instanced'
import { ZeroScaledGroup } from './zero-scaled-group'

extend({ ZeroScaledGroup })

type ItemDisplayProps = {
  id: string
  type: string
  size: Number3Tuple
  position: Number3Tuple
  rotation: Number3Tuple
  onClick?: (event: ThreeEvent<MouseEvent>) => void
  objectRef?: MutableRefObject<Group>
}

const MemoizedModel = memo(Model)
const MemoizedInstancedModel = memo(InstancedModel)

const ItemDisplay: FC<ItemDisplayProps> = ({
  id,
  type,
  // size,
  // position,
  // rotation,
  onClick,
  objectRef: ref,
}) => {
  const {
    thisEntitySelected,
    thisEntityDisplay,
    thisEntityPlayerHeadProperties,
  } = useDisplayEntityStore(
    useShallow((state) => {
      const thisEntity = state.entities.get(id)

      return {
        thisEntitySelected: state.selectedEntityIds.includes(id),
        thisEntityDisplay:
          thisEntity?.kind === 'item' ? thisEntity.display : undefined,
        thisEntityPlayerHeadProperties:
          thisEntity?.kind === 'item'
            ? thisEntity.playerHeadProperties
            : undefined,
      }
    }),
  )
  const { headPainterEnabled, headPainterLayer } = useEditorStore(
    useShallow((state) => ({
      headPainterEnabled: state.headPainter.enabled,
      headPainterLayer: state.headPainter.layer,
    })),
  )

  const boundingBoxTargetRef = useRef<Group>(null)

  // InstancedMeshManager does not support player head textures yet
  // so use the legacy non-instanced model instead
  // TODO: support player_head custom textures in InstancedMeshManager and remove this mess
  const useInstancing = thisEntityPlayerHeadProperties == null

  const playerHeadData = useMemo(
    () =>
      thisEntityPlayerHeadProperties?.texture != null
        ? {
            textureData: thisEntityPlayerHeadProperties?.texture,
            showSecondLayer:
              !headPainterEnabled || headPainterLayer === 'second',
          }
        : undefined,
    [
      headPainterEnabled,
      headPainterLayer,
      thisEntityPlayerHeadProperties?.texture,
    ],
  )

  const modelResourceLocation = `item/${type}`
  const modelList = useMemo(
    () => [
      {
        resourceLocation: modelResourceLocation,
      },
    ],
    [modelResourceLocation],
  )

  return (
    <zeroScaledGroup ref={ref}>
      {useInstancing ? (
        <BoundingBoxForInstanced
          modelList={modelList}
          visible={thisEntitySelected}
          color="#06b6d4" // tailwind v3 cyan-500
        />
      ) : (
        thisEntitySelected && <Helper type={BoxHelper} args={['gold']} />
      )}

      <group onClick={onClick} ref={boundingBoxTargetRef}>
        {useInstancing ? (
          <MemoizedInstancedModel
            entityId={id}
            resourceLocation={modelResourceLocation}
            modelId={`${id};item/${type}`}
          />
        ) : (
          <MemoizedModel
            initialResourceLocation={`item/${type}`}
            displayType={thisEntityDisplay ?? undefined}
            playerHeadData={playerHeadData}
          />
        )}
      </group>

      {thisEntityPlayerHeadProperties != null && headPainterEnabled && (
        <PlayerHeadPainter
          entityId={id}
          playerHeadProperties={thisEntityPlayerHeadProperties}
        />
      )}
    </zeroScaledGroup>
  )
}

export default ItemDisplay
