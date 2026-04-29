import i18n from 'i18next'
import HttpBackend, { type HttpBackendOptions } from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'

import { getStoredSettings } from '@/lib/settings'

export const defaultNS = 'translation'

const storedSettings = getStoredSettings()

i18n
  .use(initReactI18next)
  .use(HttpBackend)
  .init<HttpBackendOptions>({
    lng: storedSettings.general.language,
    fallbackLng: 'en',
    defaultNS,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  })
  .catch(console.error)

export default i18n
