import { Mutex } from 'async-mutex'

import fetcher from '../fetcher'
import { stripMinecraftPrefix } from '../utils'
import type {
  BlockStateApplyModelInfo,
  BlockStatesFile,
  BlockstatesData,
} from '@depl/shared'

import { AssetFileInfosCache } from './assetFileInfo'
import { blockstatesDataCache } from '../cacheStore'

export function getMatchingBlockstateModel(
  blockstatesData: BlockstatesData,
  blockstates: Record<string, string>,
) {
  return blockstatesData.models
    .map((model) => {
      let shouldRender = model.when.length < 1 // when 배열 안에 조건이 정의되어 있지 않다면 무조건 렌더링
      for (const conditionObject of model.when) {
        let andConditionCheckSuccess = true
        for (const conditionKey in conditionObject) {
          if (
            blockstates[conditionKey] == null ||
            !conditionObject[conditionKey].includes(blockstates[conditionKey])
          ) {
            andConditionCheckSuccess = false
            break
          }
        }

        if (andConditionCheckSuccess) {
          shouldRender = true
          break
        }
      }

      // when there are several `apply`s, (minecraft then randomly selects what to render)
      // then just return the first one (hardcoded for display entities)
      return shouldRender ? model.apply[0] : null
    })
    .filter((d) => d != null)
}

const blockstatesLoadMutexMap = new Map<string, Mutex>()

export async function loadBlockstates(
  blockString: string,
): Promise<BlockstatesData> {
  const blockType = blockString.split('[')[0]

  const fileInfo = await AssetFileInfosCache.instance.fetchFileInfo(
    `/assets/minecraft/blockstates/${blockType}.json`,
  )
  if (fileInfo == null) {
    throw new Error(`Cannot get info of blockstates file ${blockType}`)
  }

  const key = `${fileInfo.fromVersion};${blockType}`

  if (!blockstatesLoadMutexMap.has(key)) {
    blockstatesLoadMutexMap.set(key, new Mutex())
  }
  const mutex = blockstatesLoadMutexMap.get(key)!
  return await mutex.runExclusive(async () => {
    const directFetchedBlockstatesData = blockstatesDataCache.get(key)
    if (directFetchedBlockstatesData != null) {
      return directFetchedBlockstatesData
    }

    console.log(`Loading blockstates for block ${blockType}`)

    const { data: rawBlockstatesData } = await fetcher<BlockStatesFile>(
      `/assets/minecraft/blockstates/${blockType}.json`,
      true,
    )

    const blockDefaultValues: Record<string, string> =
      blockString != null
        ? blockString
            .slice(blockString.length + 1, -1)
            .split(',')
            .reduce((acc, cur) => {
              const [key, value] = cur.split('=')
              return {
                ...acc,
                [key]: value,
              }
            }, {})
        : {}

    const blockstateMap = new Map<
      string,
      {
        states: Set<string>
        default: string
      }
    >()
    const models: {
      // array 안에 있는 object들은 OR조건으로 계산, object들 중 하나만 맞아도 통과
      // 각 object들은 AND조건으로 계산, object 안에 있는 key와 value들이 모두 맞아야 함
      when: Record<string, string[]>[]
      apply: BlockStateApplyModelInfo[]
    }[] = []

    const addBlockstatesKeyValue = (key: string, originalValues: string[]) => {
      const values = originalValues.slice()

      // `*_fence` 울타리 블록들은 blockstates 파일에서 true만 뽑아낼 수 있기 떄문에, false 값을 직접 추가
      if (values.includes('true')) {
        values.push('false')
      } else if (values.includes('false')) {
        // 반대의 경우도 혹시나 모르지만 추가 (어차피 Set에다 넣을거라 중복안됨)
        values.push('true')
      }

      // `*_wall` 벽 블록들은 low, tall 외에 none도 state로 사용할 수 있음 (맨 처음에 넣기)
      if (values.includes('low') || values.includes('tall')) {
        values.unshift('none')
      }

      if (blockstateMap.has(key)) {
        values.forEach((v) => blockstateMap.get(key)!.states.add(v))
      } else {
        blockstateMap.set(key, {
          states: new Set(values),
          default: blockDefaultValues[key] ?? values[0],
        })
      }
    }

    if ('variants' in rawBlockstatesData) {
      for (const key in rawBlockstatesData.variants) {
        const blockstateDefinition = key.split(',').map((section) => {
          const [k, v] = section.split('=')
          return { key: k, value: v }
        })

        for (const blockstate of blockstateDefinition) {
          addBlockstatesKeyValue(blockstate.key, [blockstate.value])
        }

        const applyInfos = Array.isArray(rawBlockstatesData.variants[key])
          ? rawBlockstatesData.variants[key]
          : [rawBlockstatesData.variants[key]]
        models.push({
          when: [
            blockstateDefinition
              .filter((d) => d.key.length > 0) // key값이 `''`인 조건 없애기
              .reduce<Record<string, string[]>>(
                (acc, cur) => ({ ...acc, [cur.key]: [cur.value] }),
                {},
              ),
          ],
          apply: applyInfos.map((info) => ({
            ...info,
            model: stripMinecraftPrefix(info.model),
          })),
        })
      }
    } else if ('multipart' in rawBlockstatesData) {
      for (const multipartItem of rawBlockstatesData.multipart) {
        // when 구문이 없을 경우, 무조건 적용
        if (multipartItem.when == null) {
          const applyInfos = Array.isArray(multipartItem.apply)
            ? multipartItem.apply
            : [multipartItem.apply]
          models.push({
            when: [],
            apply: applyInfos.map((info) => ({
              ...info,
              model: stripMinecraftPrefix(info.model),
            })),
          })

          continue
        }

        if (
          'AND' in multipartItem.when &&
          Array.isArray(multipartItem.when.AND)
        ) {
          const obj: Record<string, string[]> = {}

          for (const andConditions of multipartItem.when.AND) {
            for (const key in andConditions) {
              const values = andConditions[key].split('|')

              addBlockstatesKeyValue(key, values)

              obj[key] = values
            }
          }

          const applyInfos = Array.isArray(multipartItem.apply)
            ? multipartItem.apply
            : [multipartItem.apply]
          models.push({
            when: [obj],
            apply: applyInfos.map((info) => ({
              ...info,
              model: stripMinecraftPrefix(info.model),
            })),
          })
        } else if (
          'OR' in multipartItem.when &&
          Array.isArray(multipartItem.when.OR)
        ) {
          const conditions: Record<string, string[]>[] = []

          for (const orConditions of multipartItem.when.OR) {
            const obj: Record<string, string[]> = {}

            for (const key in orConditions) {
              const values = orConditions[key].split('|')

              addBlockstatesKeyValue(key, values)

              obj[key] = values
            }

            conditions.push(obj)
          }

          const applyInfos = Array.isArray(multipartItem.apply)
            ? multipartItem.apply
            : [multipartItem.apply]
          models.push({
            when: conditions,
            apply: applyInfos.map((info) => ({
              ...info,
              model: stripMinecraftPrefix(info.model),
            })),
          })
        } else if (
          !('AND' in multipartItem.when) &&
          !('OR' in multipartItem.when)
        ) {
          // AND와 OR key가 둘 다 없는 경우, object 안에 있는 key들을 전부 하나의 AND조건으로 계산

          const obj: Record<string, string[]> = {}

          for (const key in multipartItem.when) {
            const values = multipartItem.when[key].split('|')

            addBlockstatesKeyValue(key, values)

            obj[key] = values
          }

          const applyInfos = Array.isArray(multipartItem.apply)
            ? multipartItem.apply
            : [multipartItem.apply]
          models.push({
            when: [obj],
            apply: applyInfos.map((info) => ({
              ...info,
              model: stripMinecraftPrefix(info.model),
            })),
          })
        }
      }
    }

    // blockstate가 없을 경우 empty string을 key로 사용하게 되어 map에 들어가게 됨
    // 데이터 리턴 전에 빼주기
    blockstateMap.delete('')

    const newBlockstatesData = { blockstates: blockstateMap, models }
    blockstatesDataCache.set(key, newBlockstatesData)
    return { blockstates: blockstateMap, models }
  })
}

export function calculateDefaultBlockstates(
  blockstatesData: BlockstatesData,
  override: Record<string, string> = {},
) {
  const newBlockstateObject: Record<string, string> = {}
  for (const [
    blockstateKey,
    blockstateValues,
  ] of blockstatesData.blockstates.entries()) {
    const existingValue = override[blockstateKey]
    if (existingValue == null) {
      newBlockstateObject[blockstateKey] = blockstateValues.states.has(
        blockstateValues.default,
      )
        ? blockstateValues.default
        : [...blockstateValues.states.values()][0]
    } else {
      newBlockstateObject[blockstateKey] = existingValue
    }
  }

  return newBlockstateObject
}
