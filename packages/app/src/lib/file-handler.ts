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

  const saveDataString = await gunzip(file.slice(8))
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
  const fileReader = new FileReader()
  fileReader.readAsText(file, 'utf-8')
  const rawFileContentUtf8 = await new Promise<string>((resolve) => {
    fileReader.onload = (evt) => {
      resolve(evt.target!.result as string)
    }
  })

  let byteArr
  try {
    byteArr = decodeBase64ToBinary(rawFileContentUtf8)
  } catch (err) {
    // failing from base64 -> binary usually means
    // that the input file is not base64 encoded text
    // so just process as unsupported file
    logger.error(err)
    return false
  }

  const blob = new Blob([byteArr])
  const saveDataString = await gunzip(blob)
  const saveData = JSON.parse(saveDataString) as BDEngineSaveData

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
