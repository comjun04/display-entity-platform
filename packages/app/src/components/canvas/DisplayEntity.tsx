import { type ThreeEvent, invalidate } from '@react-three/fiber'
import { type FC, useCallback, useEffect } from 'react'
import { useShallow } from 'zustand/shallow'

import useEntityRefObject from '@/hooks/useEntityRefObject'
import { deleteEntities } from '@/lib/entities'
import { getLogger } from '@/lib/logger'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import { useEntityRefStore } from '@/stores/entityRefStore'

import BlockDisplay from './BlockDisplay'
import DisplayEntityGroup from './DisplayEntityGroup'
import ItemDisplay from './ItemDisplay'
import TextDisplay from './TextDisplay'

const logger = getLogger('DisplayEntity')

type DisplayEntityProps = {
  id: string
}

const DisplayEntity: FC<DisplayEntityProps> = ({ id }) => {
  const { thisEntity } = useDisplayEntityStore(
    useShallow((state) => ({
      thisEntity: state.entities.get(id),
    })),
  )

  const thisEntityRefObj = useEntityRefObject(id)
  const parentGroupRefObj = useEntityRefObject(thisEntity?.parent ?? null)

  const { thisEntityRef } = useEntityRefStore(
    useShallow((state) => {
      // parent 값이 있지만 ref가 없을 경우 무언가 문제가 발생했다고 알려주려 했는데,
      // 여러 entity를 삭제하는 경우에 이런 현상이 자연스럽게 생길 수 있어서 관련 코드 비활성화
      // if (
      //   thisEntity?.parent != null &&
      //   !state.entityRefs.has(thisEntity.parent)
      // ) {
      //   console.warn(
      //     'thisEntity.parent is not null, but parent entity ref is null',
      //   )
      // }

      return {
        thisEntityRef: state.entityRefs.get(id),
      }
    }),
  )

  // 엔티티의 parent가 바뀌면 reparenting 진행
  useEffect(() => {
    if (thisEntityRefObj == null) return

    logger.debug('reparenting')

    // parent group의 ref가 연결되지 않은 경우
    // (임시로) root group ref를 사용
    const parentGroup =
      parentGroupRefObj ??
      useEntityRefStore.getState().rootGroupRefData.objectRef.current
    parentGroup.add(thisEntityRefObj)
  }, [thisEntityRefObj, parentGroupRefObj])

  // 내가 group 안에 children이 더 이상 없으면 나 자신도 삭제
  useEffect(() => {
    if (thisEntity?.kind === 'group' && thisEntity.children.length < 1) {
      logger.debug('detected no children in group, deleting itself')
      deleteEntities([id], true)
    }
  }, [id, thisEntity])

  useEffect(() => {
    if (
      thisEntity?.position == null ||
      thisEntity?.rotation == null ||
      thisEntity?.size == null
    ) {
      return
    }
    if (thisEntityRefObj == null) return

    thisEntityRefObj.position.set(...thisEntity.position)
    thisEntityRefObj.rotation.set(...thisEntity.rotation)
    thisEntityRefObj.scale.set(...thisEntity.size)

    thisEntityRefObj.updateMatrix() // need to update transformation properly when modifying outside render loop
    thisEntityRefObj.updateMatrixWorld() // makes updated world matrix always available on next frame

    invalidate()
  }, [
    thisEntity?.position,
    thisEntity?.rotation,
    thisEntity?.size,
    thisEntityRefObj,
  ])

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (thisEntity == null) return
      if (useEditorStore.getState().headPainter.enabled) return

      const { usingTransformControl } = useEditorStore.getState()
      if (usingTransformControl) return

      const { selectedEntityIds, setSelected } =
        useDisplayEntityStore.getState()

      if (thisEntity.kind !== 'group') {
        // group이 아닌 경우 최상단에 있거나, 다른 그룹둘에 둘러싸여 트리 최하단에 있음.
        if (
          thisEntity.parent == null ||
          (selectedEntityIds.length === 1 &&
            selectedEntityIds.includes(thisEntity.parent))
        ) {
          setSelected([id])
          // 현재 엔티티/그룹의 부모 + 화면상에 여러 그룹이나 엔티티가 겹쳐 있을때 클릭한 경우 자기보다 멀리 떨어져 있는 엔티티한테도 이벤트 전달하는걸 방지함.
          // 이렇게 해야 클릭한 시점에서 화면에 완전히 보이는 엔티티만 처리하게 만들 수 있고
          // 부모 엔티티가 자신이 선택되어야 하는 시점으로 오해해 이상하게 엔티티가 선택되는 것을 방지할 수 있음
          // https://r3f.docs.pmnd.rs/api/events#event-propagation-(bubbling)
          event.stopPropagation()
        }
      } else {
        // 다중선택되어 있거나 아무것도 선택되어 있지 않은 경우, 이 그룹이 최상단에 있디만 선택함
        if (selectedEntityIds.length !== 1 && thisEntity.parent == null) {
          setSelected([id])
          event.stopPropagation()
        } else if (selectedEntityIds.length === 1) {
          // 1개만 선택되어 있는 경우
          // 그룹 안의 엔티티가 선택된 경우일 수 있으므로 순서를 체크해야 함
          if (
            thisEntity.parent != null &&
            selectedEntityIds.includes(thisEntity.parent)
          ) {
            // 내가 최상단이 아니고 부모가 선택되어 있는 상태일 경우 내가 선택될 차례이므로 선택 처리
            // (내 부모 엔티티 그룹) -> (나)
            setSelected([id])
            event.stopPropagation()
          } else if (thisEntity.parent == null) {
            // 내가 최상단일 경우
            // 내 자식으로 등록된 엔티티들은 나까지 오기 전에 이미 처리되고 이벤트 전파되지 않음
            // 자식 중 제일 최하단에 등록된 엔티티거나, 다른 그룹에 있는 엔티티/그룹이거나일 경우에만 여기까지 실행되므로
            // 선택 처리
            setSelected([id])
          }
        }
      }

      if (thisEntity.parent == null) {
        event.stopPropagation()
      }
    },
    [thisEntity, id],
  )

  if (thisEntity == null) return null

  if (thisEntity.kind === 'block') {
    return (
      <BlockDisplay
        id={id}
        type={thisEntity.type}
        position={thisEntity.position}
        rotation={thisEntity.rotation}
        size={thisEntity.size}
        onClick={handleClick}
        objectRef={thisEntityRef?.objectRef}
      />
    )
  } else if (thisEntity.kind === 'item') {
    return (
      <ItemDisplay
        id={id}
        type={thisEntity.type}
        position={thisEntity.position}
        rotation={thisEntity.rotation}
        size={thisEntity.size}
        onClick={handleClick}
        objectRef={thisEntityRef?.objectRef}
      />
    )
  } else if (thisEntity.kind === 'text') {
    return (
      <TextDisplay
        id={id}
        text={thisEntity.text}
        position={thisEntity.position}
        rotation={thisEntity.rotation}
        size={thisEntity.size}
        onClick={handleClick}
        objectRef={thisEntityRef?.objectRef}
      />
    )
  } else if (thisEntity.kind === 'group') {
    return (
      <DisplayEntityGroup
        id={id}
        position={thisEntity.position}
        rotation={thisEntity.rotation}
        size={thisEntity.size}
        onClick={handleClick}
        objectRef={thisEntityRef?.objectRef}
      />
    )
  }

  return null
}

export default DisplayEntity
