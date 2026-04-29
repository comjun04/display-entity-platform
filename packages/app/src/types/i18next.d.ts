import enTranslation from '@/../public/locales/en/translation.json'
import { defaultNS } from '@/lib/i18n/config'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: {
      translation: typeof enTranslation
    }
    enableSelector: true
  }
}
