import { type FC, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { LuArrowRight } from 'react-icons/lu'
import { useShallow } from 'zustand/shallow'

import { Title } from '@/components/brandings'
import type { Settings } from '@/lib/settings/prelude'
import { useDialogStore } from '@/stores/dialogStore'
import { useEditorStore } from '@/stores/editorStore'

import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Field, FieldLabel } from '../ui/field'
import { NativeSelect, NativeSelectOption } from '../ui/native-select'
import Dialog from './Dialog'

const FirstTimeWelcomeDialog: FC = () => {
  const { t } = useTranslation()

  const { isOpen, openDialog } = useDialogStore(
    useShallow((state) => ({
      isOpen: state.activeDialog === 'firstTimeWelcome',
      openDialog: state.openDialog,
    })),
  )
  const { language, setSettings } = useEditorStore(
    useShallow((state) => ({
      language: state.settings.general.language,
      setSettings: state.setSettings,
    })),
  )

  const [agreeMinecraftEula, setAgreeMinecraftEula] = useState(false)
  const canStart = agreeMinecraftEula

  const handleStart = () => {
    if (!canStart) return

    setSettings({
      general: {
        agreeMinecraftEula: true,
      },
    })

    openDialog('welcome')
  }

  return (
    <Dialog title="" open={isOpen} onClose={() => {}} disableUserClose>
      <div className="relative flex h-full flex-col gap-2 overflow-auto">
        <div className="inline text-2xl">
          <Trans
            i18nKey={($) => $.dialog.firstTimeWelcome.title}
            ns="translation"
            components={{
              styledTitle: <Title className="inline" />,
            }}
          />
        </div>

        <div className="mt-4 rounded-lg bg-neutral-800 p-4">
          <h4 className="text-xl">
            {' '}
            {t(($) => $.dialog.firstTimeWelcome.quickSetup.title)}
          </h4>
          <Field orientation="horizontal">
            <FieldLabel htmlFor="firstTimeWelcome_quickSetting_language">
              {t(($) => $.dialog.firstTimeWelcome.quickSetup.fields.language)}
            </FieldLabel>
            <NativeSelect
              id="firstTimeWelcome_quickSetting_language"
              value={language}
              onChange={(evt) => {
                setSettings({
                  general: {
                    language: evt.target
                      .value as Settings['general']['language'],
                  },
                })
              }}
            >
              <NativeSelectOption value="en">English</NativeSelectOption>
              <NativeSelectOption value="ko">한국어</NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>

        <div className="absolute bottom-0 flex w-full flex-col gap-2">
          <div>{t(($) => $.dialog.firstTimeWelcome.agreeTerms.desc)}</div>
          <Field orientation="horizontal">
            <Checkbox
              id="firstTimeWelcome_agreeMinecraftEula"
              checked={agreeMinecraftEula}
              onCheckedChange={setAgreeMinecraftEula}
            />
            <FieldLabel
              htmlFor="firstTimeWelcome_agreeMinecraftEula"
              className="inline"
            >
              <Trans
                i18nKey={($) =>
                  $.dialog.firstTimeWelcome.agreeTerms.minecraftEula
                }
                ns="translation"
                components={{
                  eulaLink: (
                    <a
                      href="https://minecraft.net/eula"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    />
                  ),
                }}
              />
            </FieldLabel>
          </Field>

          <div className="flex justify-end overflow-hidden">
            <Button size="lg" disabled={!canStart} onClick={handleStart}>
              {t(($) => $.dialog.firstTimeWelcome.startButton)}
              <LuArrowRight />
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export default FirstTimeWelcomeDialog
