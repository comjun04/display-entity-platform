import { type ThreeEvent, extend } from '@react-three/fiber'
import { type FC, type MutableRefObject, memo, useMemo, useRef } from 'react'
import { Group } from 'three'
import { useShallow } from 'zustand/shallow'

import { useItemsModel } from '@/hooks/useItemsModel'
import { stripMinecraftPrefix } from '@/lib/utils'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import { type Number3Tuple } from '@/types/base'

import { BoundingBox, BoundingBoxForInstanced } from './BoundingBox'
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

  const itemsModelData = useItemsModel(type)
  const models = itemsModelData != null ? [itemsModelData] : []

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
    <zeroScaledGroup
      ref={ref}
      name={`ItemDisplay ${id} ${type}`}
      matrixAutoUpdate={false}
    >
      {useInstancing ? (
        <BoundingBoxForInstanced
          entityKind="item"
          modelList={modelList}
          visible={thisEntitySelected}
          color="#06b6d4" // tailwind v3 cyan-500
          displayType={thisEntityDisplay ?? undefined}
        />
      ) : (
        <BoundingBox
          object={boundingBoxTargetRef.current ?? undefined}
          visible={thisEntitySelected}
          color="#06b6d4"
        />
      )}

      <group
        onClick={onClick}
        ref={boundingBoxTargetRef}
        matrixAutoUpdate={false}
      >
        {useInstancing ? (
          models.map((modelToApply, idx) => {
            const resourceLocation = stripMinecraftPrefix(modelToApply.model)
            const modelId = `${id}|${resourceLocation}|${idx}`

            return (
              <MemoizedInstancedModel
                key={idx}
                entityId={id}
                entityKind="item"
                resourceLocation={resourceLocation}
                modelId={modelId}
                displayType={thisEntityDisplay ?? undefined}
              />
            )
          })
        ) : (
          <MemoizedModel
            initialResourceLocation={`item/${type}`}
            displayType={thisEntityDisplay ?? undefined}
            playerHeadData={playerHeadData}
          />
        )}
      </group>

      {thisEntityPlayerHeadProperties != null && (
        <PlayerHeadPainter
          entityId={id}
          playerHeadProperties={thisEntityPlayerHeadProperties}
          disabled={!headPainterEnabled}
        />
      )}
    </zeroScaledGroup>
  )
}

export default ItemDisplay
