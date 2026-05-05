import { t } from 'i18next'
import { toast } from 'sonner'

import { LatestGameVersion, LegacyHardcodedGameVersion } from '@/constants'
import { decodeBase64ToBinary, gunzip, gzip } from '@/lib/utils'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import type { BDEngineSaveData, DisplayEntitySaveDataItem } from '@/types/base'

import { clearProject } from './actions'
import { getLogger } from './logger'
import AutosaveService from './services/autosave.service'

// circular import, but not a problem because AutosaveService is a Singleton class

const logger = getLogger('file-handler')

interface DisplayEntitySaveDataBase {
  __version: number
  __program: string
  entities: DisplayEntitySaveDataItem[]
}
interface DisplayEntitySaveData_V3 extends DisplayEntitySaveDataBase {
  targetGameVersion: string
}
interface DisplayEntitySaveData_V4 extends DisplayEntitySaveData_V3 {
  projectName: string
}

type DisplayEntitySaveData_Latest = DisplayEntitySaveData_V4

const FILE_MAGIC = 'DEPL'
const FILE_VERSION = 6

const fileVersionArrayBuffer = new ArrayBuffer(4)
const fileVersionDataView = new DataView(fileVersionArrayBuffer)
fileVersionDataView.setUint32(0, FILE_VERSION, false)

export function openFileFromUserSelect() {
  const inputElement = document.createElement('input')
  inputElement.type = 'file'
  inputElement.accept = '.depl,.bdengine'
  inputElement.onchange = (evt) => {
    const file = (evt.target as HTMLInputElement).files?.[0]
    if (file == null) {
      return
    }

    openFromFile(file).catch(console.error)
  }

  inputElement.click()
}

export async function openFromFile(file: Blob) {
  // first clear current project and reset editor
  const projectCleared = await clearProject()
  if (!projectCleared) {
    logger.warn(
      'Project not cleared for some reason. Stopping file opening sequence.',
    )
    return false
  }

  try {
    // first try to open as depl project
    const isDeplProject = await openProjectFile(file)
    if (isDeplProject) return

    // if not, try to open with bdengine file
    const isBDEProject = await importFromBDE(file)
    if (isBDEProject) return

    toast.error(t(($) => $.toast.unsupportedFile))
  } catch (err) {
    logger.error(err)
    toast.error(
      'An error occured when opening file. Please check browser console for more info.',
    )
  }
}

async function openProjectFile(file: Blob): Promise<boolean> {
  if (file.size < 10) {
    logger.error(
      'Cannot open project file: cannot extract file header, file too small',
    )
    return false
  }

  const magic = await file.slice(0, 4).text()
  if (magic !== FILE_MAGIC) {
    logger.error('Cannot open project file: project file magic does not match')
    return false
  }

  const versionArrayBuffer = await file.slice(4, 8).arrayBuffer()
  const dataview = new DataView(versionArrayBuffer)
  const version = dataview.getUint32(0, false)
  if (version > FILE_VERSION) {
    logger.error(
      `Cannot open project file (version ${version}) higher than supported version ${FILE_VERSION}`,
    )
    return false
  }

  const saveDataString = await gunzip(file.slice(8), 'text')
  const saveData = JSON.parse(saveDataString) as DisplayEntitySaveDataBase
  // TODO: saveData type validation

  toast(t(($) => $.toast.loadingProject))

  const { bulkImport } = useDisplayEntityStore.getState()
  const { setTargetGameVersion, setProjectName } = useProjectStore.getState()

  // load targetGameVersion
  const targetGameVersion =
    saveData.__version >= 3
      ? (saveData as DisplayEntitySaveData_Latest).targetGameVersion
      : LegacyHardcodedGameVersion
  setTargetGameVersion(targetGameVersion)

  // load projectName
  const projectName =
    saveData.__version >= 4
      ? (saveData as DisplayEntitySaveData_Latest).projectName
      : ''
  setProjectName(projectName)

  // load entities
  bulkImport(saveData.entities).catch(logger.error)

  return true
}

export async function saveToFile() {
  const { projectName } = useProjectStore.getState()
  const saveDataBlob = await createSaveData()

  const objectUrl = URL.createObjectURL(saveDataBlob)
  const tempElement = document.createElement('a')
  tempElement.href = objectUrl
  tempElement.download = `${projectName}.depl`
  tempElement.click() // trigger download

  URL.revokeObjectURL(objectUrl)

  toast.success(t(($) => $.toast.projectSaved))

  useEditorStore.getState().setProjectDirty(false)
  // delete autosave because user already saved to local disk
  AutosaveService.instance.deleteSave()
}

export async function createSaveData() {
  const rootEntities = useDisplayEntityStore.getState().exportAll()
  const { targetGameVersion, projectName } = useProjectStore.getState()
  const finalSaveObject = {
    __version: FILE_VERSION,
    __program: 'Display Entity Platform',
    projectName,
    targetGameVersion,
    entities: rootEntities,
  } satisfies DisplayEntitySaveData_Latest

  const finalSaveObjectString = JSON.stringify(finalSaveObject)

  const blob = await gzip(finalSaveObjectString)
  const newBlob = new Blob([FILE_MAGIC, fileVersionArrayBuffer, blob], {
    type: 'application/octet-stream', // prevent chrome mobile from downloading as `project.depl.txt`
  })

  return newBlob
}

// ===============
// BDEngine

async function importFromBDE(file: Blob): Promise<boolean> {
  const saveData = await decodeBDEngineProjectData(file).catch((err) => {
    logger.error('Cannot open bdengine project:', err)
    return null
  })
  if (saveData == null) return false

  toast(t(($) => $.toast.importingBDEProject))

  const { bulkImportFromBDE, clearEntities } = useDisplayEntityStore.getState()
  const { setTargetGameVersion, setProjectName } = useProjectStore.getState()

  // reset project and load data
  clearEntities()
  useEditorStore.getState().resetProject()

  // load targetGameVersion
  // BDEngine project does not have project version or target minecraft version
  // Since BDEngine always targets latest minecraft version so we use that
  setTargetGameVersion(LatestGameVersion)

  // load projectName
  setProjectName(saveData[0].name)

  bulkImportFromBDE(saveData).catch(logger.error)

  return true
}

async function decodeBDEngineProjectData(raw: Blob): Promise<BDEngineSaveData> {
  const textDecoder = new TextDecoder()

  const headerCheck = await raw.slice(0, 4).text()
  if (headerCheck === 'H4sI') {
    // base64-encoded gzipped file header `H4sIAAAAA...`
    // legacy-gzip type file
    const textDecoder = new TextDecoder()
    const text = textDecoder.decode(await raw.arrayBuffer())
    const byteArr = decodeBase64ToBinary(text)

    const blob = new Blob([byteArr])
    const saveDataString = await gunzip(blob, 'text')
    const saveData = JSON.parse(saveDataString) as BDEngineSaveData
    return saveData
  }

  /*
   * The new bdengine project format is structured like this:
   * - 0x0: container magic (4 byte string)
   * - 0x4: project version (1 byte number)
   * - 0x5: container data
   *
   * container magic is either `PRJ1` or `PRJ2`
   */

  const unzippedRawByteArr = new Uint8Array(await gunzip(raw, 'arraybuffer'))
  const dv = new DataView(unzippedRawByteArr.buffer)

  const magic = String.fromCharCode(...unzippedRawByteArr.slice(0, 4))
  const version = unzippedRawByteArr[5]

  if (magic === 'PRJ1' || magic === 'PRJ2') {
    if (version !== 1) {
      throw new Error(`Unsupported project version: ${version}`)
    } else if (unzippedRawByteArr.length < 9) {
      throw new Error(`Invalid ${magic} container`)
    }

    let targetFileBinary: Uint8Array | undefined = undefined

    if (magic === 'PRJ1') {
      /*
       * PRJ1 container data structure
       * - scene.json length (4 bytes uint8, little-endian)
       * - scene.json content
       */

      const start = 0
      const end = start + dv.getUint32(5, true)
      if (end > unzippedRawByteArr.length) {
        throw new Error('Invalid PRJ1 JSON length')
      }

      targetFileBinary = unzippedRawByteArr.slice(start, end)
    } else if (magic === 'PRJ2') {
      /*
       * PRJ2 container data structure
       * - file_count (4 bytes uint8, little-endian)
       * - `FILE`s (count: file_count)
       *
       * on each `FILE`:
       * - file_path_length (2 bytes uint16, little-endian)
       * - file path (string, length: file_path_length)
       * - file_data_length (4 bytes uint32, little-endian)
       * - file data (string, length: file_data_length)
       */

      const entryCount = dv.getUint32(5, true)
      const entries: Record<string, Uint8Array> = {}
      let offset = 9

      for (let i = 0; i < entryCount; i++) {
        if (offset + 2 > unzippedRawByteArr.length) {
          throw new Error('Invalid PRJ2 path length')
        }

        const pathLength = dv.getUint16(offset, true)
        offset += 2
        if (offset + pathLength + 4 > unzippedRawByteArr.length) {
          throw new Error('Invalid PRJ2 path')
        }

        const path = textDecoder.decode(
          unzippedRawByteArr.subarray(offset, offset + pathLength),
        )
        offset += pathLength

        const dataLength = dv.getUint32(offset, true)
        offset += 4
        if (offset + dataLength > unzippedRawByteArr.length) {
          throw new Error('Invalid PRJ2 entry length')
        }

        entries[path] = unzippedRawByteArr.slice(offset, offset + dataLength)
        offset += dataLength
      }

      targetFileBinary = entries['scene.json']
    }

    if (targetFileBinary == null) {
      throw new Error('scene.json not found in project container')
    }

    return JSON.parse(textDecoder.decode(targetFileBinary)) as BDEngineSaveData
  } else {
    throw new Error('Unsupported format')
  }
}
