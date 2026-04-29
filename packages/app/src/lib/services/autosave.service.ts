import { decodeBase64ToBinary, encodeBinaryToBase64 } from '@/lib/utils'

import { createSaveData, openFromFile } from '../file-handler'
import { getLogger } from '../logger'

const AUTOSAVE_KEY = 'autoSavedProject'

const logger = getLogger('AutosaveService')

export default class AutosaveService {
  private static _instance?: AutosaveService

  private constructor() {}

  static get instance() {
    if (this._instance == null) {
      this._instance = new AutosaveService()
    }
    return this._instance
  }

  private operationCount = 0
  private debounceTimer?: ReturnType<typeof setTimeout>

  /**
   * method to execute when project is modified
   * run autosave if required
   */
  markOperationPerformed() {
    // clear previous timer and set a new one
    if (this.debounceTimer != null) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      logger.debug('debounce timer fired, running autosave')
      this.doActualSave().catch(console.error)
      this.debounceTimer = undefined
    }, 10000)

    // increase operation count and run save if count hits limit
    this.operationCount++
    if (this.operationCount >= 5) {
      logger.debug('operationCount hitted limit, running autosave')

      this.operationCount = 0
      this.doActualSave().catch(console.error)
    }
  }

  /**
   * Force save project to autosave, ignoring any debounce or operation counts.
   */
  async forceSave() {
    logger.debug('forceSave()')
    await this.doActualSave()
  }

  private async doActualSave() {
    logger.info('doActualSave(): running autosave')
    const saveDataBlob = await createSaveData()

    // base64 encode
    const a = new Uint8Array(await saveDataBlob.arrayBuffer())
    const encoded = encodeBinaryToBase64(a)

    // save to localStorage
    window.localStorage.setItem(AUTOSAVE_KEY, encoded)
    logger.info('doActualSave(): save complete')
  }

  get saveExist() {
    return window.localStorage.getItem(AUTOSAVE_KEY) != null
  }

  async loadSave() {
    const saveDataEncoded = window.localStorage.getItem(AUTOSAVE_KEY)
    if (saveDataEncoded == null) {
      throw new Error('Autosave data does not exist')
    }

    logger.log('loading autosaved data')

    // base64 decode
    const saveData = decodeBase64ToBinary(saveDataEncoded)
    await openFromFile(new Blob([saveData]))
  }

  deleteSave() {
    window.localStorage.removeItem(AUTOSAVE_KEY)
  }
}
