import type { FC } from 'react'
import { useShallow } from 'zustand/shallow'

import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEntityRefStore } from '@/stores/entityRefStore'

import DisplayEntity from './canvas/DisplayEntity'

const DisplayentitiesRootGroup: FC = () => {
  const { rootGroupRefData } = useEntityRefStore(
    useShallow((state) => ({
      rootGroupRefData: state.rootGroupRefData,
    })),
  )
  // 매번 다른 array가 생성돼서 array 안의 값을 shallow equal로 검사하기 위해 따로 선언
  const entityIds = useDisplayEntityStore(
    useShallow((state) => [...state.entities.keys()]),
  )

  return (
    <group
      name="Display Entities"
      ref={rootGroupRefData.objectRef}
      matrixAutoUpdate={false}
    >
      {entityIds.map((id) => (
        <DisplayEntity key={id} id={id} />
      ))}
    </group>
  )
}

export default DisplayentitiesRootGroup
