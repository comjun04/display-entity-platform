import { useDebouncedEffect } from '@react-hookz/web'
import { useVirtualizer } from '@tanstack/react-virtual'
import JSZip from 'jszip'
import {
  type ComponentPropsWithoutRef,
  type FC,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Trans, useTranslation } from 'react-i18next'
import {
  LuCircleAlert,
  LuCircleSlash,
  LuCopy,
  LuCopyCheck,
} from 'react-icons/lu'
import { toast } from 'sonner'
import { useShallow } from 'zustand/shallow'

import { GameVersions } from '@/constants'
import { type NbtStringGeneratePayload, generateNbtStrings } from '@/lib/nbt'
import { cn, downloadFile } from '@/lib/utils'
import { useDialogStore } from '@/stores/dialogStore'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import { useEntityRefStore } from '@/stores/entityRefStore'
import { useProjectStore } from '@/stores/projectStore'
import type {
  ExportedNBTGeneratorWorkerMessage,
  ExportedNBTGeneratorWorkerResponse,
} from '@/types/workers'

import { Button } from '../ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '../ui/field'
import { Input } from '../ui/input'
import { Switch } from '../ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import Dialog from './Dialog'

type CopyButtonProps = ComponentPropsWithoutRef<'button'> & {
  valueToCopy: string
}

const CopyButton: FC<CopyButtonProps> = ({
  valueToCopy,
  onClick,
  ...props
}) => {
  const { t } = useTranslation()

  const [clicked, setClicked] = useState(false)
  const [showCopiedState, setShowCopiedState] = useState(false)

  useDebouncedEffect(
    () => {
      setShowCopiedState(false)
    },
    [clicked, showCopiedState],
    1500,
  )

  useEffect(() => {
    if (clicked) {
      setShowCopiedState(true)
      setClicked(false)
    }
  }, [clicked])

  return (
    <Button
      variant="outline"
      onClick={(evt) => {
        onClick?.(evt)
        void navigator.clipboard.writeText(valueToCopy)
        setClicked(true)
      }}
      {...props}
    >
      {showCopiedState ? (
        <>
          <LuCopyCheck />
          {t(($) => $.dialog.exportToMinecraft.result.copyBtn.copied)}
        </>
      ) : (
        <>
          <LuCopy />
          {t(($) => $.dialog.exportToMinecraft.result.copyBtn.normal)}
        </>
      )}
    </Button>
  )
}

type TagValidatorInputProps = {
  onChange?: (text: string) => void
}

const TagValidatorInput: FC<TagValidatorInputProps> = ({ onChange }) => {
  const { t } = useTranslation()

  const [input, setInput] = useState('')
  const [hasValidationErrors, setHasValidationErrors] = useState(false)

  return (
    <Field data-invalid={hasValidationErrors}>
      <FieldLabel>
        {t(($) => $.dialog.exportToMinecraft.baseTag.title)}
      </FieldLabel>
      <Input
        value={input}
        onChange={(evt) => {
          const text = evt.target.value
          setInput(text)

          if (/^[a-z0-9_\-.+]*$/gi.test(text)) {
            setHasValidationErrors(false)
            onChange?.(text)
          } else {
            setHasValidationErrors(true)
          }
        }}
      />
      {hasValidationErrors && (
        <FieldError>
          <Trans
            i18nKey={($) => $.dialog.exportToMinecraft.baseTag.invalidTagNotice}
            ns="translation"
            components={{
              codeblock: (
                <code className="rounded-sm bg-neutral-800 p-1 font-mono" />
              ),
            }}
          />
        </FieldError>
      )}
      <FieldDescription>
        {t(($) => $.dialog.exportToMinecraft.baseTag.desc)}
      </FieldDescription>
    </Field>
  )
}

interface DatapackNamespaceFieldProps {
  onChange: (text: string) => void
}
const DatapackNamespaceField: FC<DatapackNamespaceFieldProps> = ({
  onChange,
}) => {
  const { t } = useTranslation()

  const [input, setInput] = useState('minecraft')
  const [hasValidationErrors, setHasValidationErrors] = useState(false)

  return (
    <Field orientation="responsive" data-invalid={hasValidationErrors}>
      <FieldContent>
        <FieldLabel>
          {t(($) => $.dialog.exportToMinecraft.datapack.options.namespace.name)}
        </FieldLabel>
        {hasValidationErrors && (
          <FieldError>
            <Trans
              i18nKey={($) =>
                $.dialog.exportToMinecraft.datapack.options.namespace
                  .invalidValue
              }
              components={{
                codeblock: (
                  <code className="rounded-sm bg-neutral-800 p-1 font-mono" />
                ),
              }}
            />
          </FieldError>
        )}
        <FieldDescription>
          {t(($) => $.dialog.exportToMinecraft.datapack.options.namespace.desc)}
        </FieldDescription>
      </FieldContent>
      <Input
        className="w-auto"
        value={input}
        onChange={(evt) => {
          const text = evt.target.value
          setInput(text)

          if (/^[a-z0-9_\-.]*$/g.test(text) && text !== '..') {
            setHasValidationErrors(false)
            onChange?.(text)
          } else {
            setHasValidationErrors(true)
          }
        }}
      />
    </Field>
  )
}

const ExportToMinecraftDialog: FC = () => {
  const { t } = useTranslation()

  const { isOpen, closeActiveDialog } = useDialogStore(
    useShallow((state) => ({
      isOpen: state.activeDialog === 'exportToMinecraft',
      closeActiveDialog: state.closeActiveDialog,
    })),
  )
  const { entities } = useDisplayEntityStore(
    useShallow((state) => ({
      entities: state.entities,
    })),
  )
  const { targetGameVersion, mainNBT } = useProjectStore(
    useShallow((state) => ({
      targetGameVersion: state.targetGameVersion,
      mainNBT: state.mainNBT,
    })),
  )

  const [baseTag, setBaseTag] = useState('')
  const [nbtDataGenerating, setNbtDataGenerating] = useState(false)
  const [nbtDataValid, setNbtDataValid] = useState(true)
  const [nbtStrings, setNbtStrings] = useState<string[]>([])

  const nbtGeneratorWorkerRef = useRef<Worker>()
  useEffect(() => {
    const cleanup = () => {
      nbtGeneratorWorkerRef.current?.terminate()
    }

    const nbtValidationEnabled =
      useEditorStore.getState().settings.general.validateNbtInput

    // TODO: make it suspend using `use()` after react v19 upgrade
    if (isOpen) {
      if (entities.size < 1) {
        setNbtStrings([])
        setNbtDataGenerating(false)
        return cleanup
      }

      const { entityRefs } = useEntityRefStore.getState()
      const payload = [...entities.values()].reduce((acc, cur) => {
        const refData = entityRefs.get(cur.id)
        if (refData != null) {
          const worldMatrix = refData.objectRef.current.matrixWorld
            .clone()
            .transpose()
            .toArray()
          acc.set(cur.id, {
            entity: cur,
            worldMatrix,
          })
        }

        return acc
      }, new Map<string, NbtStringGeneratePayload>())

      if (nbtValidationEnabled) {
        nbtGeneratorWorkerRef.current = new Worker(
          new URL(
            '../../workers/exportedNbtGenerator.worker.ts',
            import.meta.url,
          ),
          { type: 'module' },
        )

        setNbtDataGenerating(true)

        nbtGeneratorWorkerRef.current?.addEventListener(
          'message',
          (evt: MessageEvent<ExportedNBTGeneratorWorkerResponse>) => {
            const msg = evt.data

            if (msg.type === 'data') {
              setNbtStrings(msg.data.nbtStrings)
              setNbtDataGenerating(false)
              setNbtDataValid(!msg.data.invalidNBTExist)
            }
          },
        )

        nbtGeneratorWorkerRef.current?.postMessage({
          cmd: 'generate',
          data: {
            payload,
            targetGameVersion,
            baseTag,
            mainNBT,
            validateNBT: true,
          },
        } satisfies ExportedNBTGeneratorWorkerMessage)
      } else {
        const { nbtStrings, invalidNBTExist } = generateNbtStrings({
          payload,
          targetGameVersion,
          baseTag,
          mainNBT,
          validateNBT: false,
        })

        setNbtStrings(nbtStrings)
        setNbtDataGenerating(false)
        setNbtDataValid(!invalidNBTExist)
      }
    }

    return cleanup
  }, [isOpen, entities, targetGameVersion, baseTag, mainNBT]) // 엔티티 데이터나 태그가 바뀌었다면 커맨드를 다시 생성해야 함

  useEffect(() => {
    if (isOpen) {
      setBaseTag('')
    }
  }, [isOpen])

  const summonCommands = nbtStrings.map(
    (nbt) => `/summon block_display ~ ~ ~ ${nbt}`,
  )
  const summonCommandsExist = summonCommands.length > 0
  const removeCommand = `/kill @e[${baseTag.length > 0 ? `tag=${baseTag}` : 'type=block_display'},distance=..2]`

  const [commandListParentRef, setCommandListParentRef] =
    useState<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: summonCommandsExist ? summonCommands.length + 1 : 0,
    getScrollElement: () => commandListParentRef,
    estimateSize: () => 60,
    overscan: 5,
    gap: 8,
  })

  const [namespace, setNamespace] = useState('minecraft')
  const [compressDatapack, setCompressDatapack] = useState(true)
  const datapackOptions = {
    namespace: namespace.length > 0 ? namespace : 'minecraft',
    compress: compressDatapack,
  }

  return (
    <Dialog
      title={t(($) => $.dialog.exportToMinecraft.title)}
      open={isOpen}
      onClose={closeActiveDialog}
    >
      <div className="rounded-lg bg-neutral-700 p-2">
        <TagValidatorInput onChange={setBaseTag} />
      </div>

      {!nbtDataValid && (
        <div className="flex flex-row items-center gap-2 rounded bg-amber-950 p-2 text-amber-50">
          <LuCircleAlert size={20} />{' '}
          {t(($) => $.dialog.exportToMinecraft.invalidNBTDataExist)}
        </div>
      )}

      <Tabs defaultValue="command" className="h-full min-h-0">
        <TabsList>
          <TabsTrigger value="command">
            {t(($) => $.dialog.exportToMinecraft.tabs.command)}
          </TabsTrigger>
          <TabsTrigger value="datapack">
            {t(($) => $.dialog.exportToMinecraft.tabs.datapack)}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="command" className="flex min-h-0 flex-col gap-2">
          {nbtStrings.length > 0 && (
            <div className="flex gap-2">
              <Button onClick={() => downloadAsMcfunction(summonCommands)}>
                Download summon .mcfunction
              </Button>
            </div>
          )}

          {nbtStrings.length < 1 && (
            <div className="flex grow flex-col items-center justify-center gap-1 text-neutral-600">
              <LuCircleSlash size={48} className="" />
              <span className="text-center text-lg">
                {t(($) => $.dialog.exportToMinecraft.result.noEntities)}
              </span>
            </div>
          )}

          <div
            className={cn('overflow-y-auto', summonCommandsExist && 'h-full')}
            ref={(element) => setCommandListParentRef(element)}
          >
            <div
              className="relative w-full"
              style={{
                height: virtualizer.getTotalSize(),
              }}
            >
              {virtualizer.getVirtualItems().map((item) => {
                if (item.index < summonCommands.length) {
                  // summon command
                  const command = summonCommands[item.index]
                  return (
                    <div
                      key={item.key}
                      className="absolute top-0 left-0 w-full"
                      style={{
                        height: item.size,
                        transform: `translateY(${item.start}px)`,
                      }}
                    >
                      <div className="flex flex-row items-center">
                        <span className="grow">
                          {t(
                            ($) =>
                              $.dialog.exportToMinecraft.result.summonCommand,
                            {
                              n: item.index + 1,
                            },
                          )}
                        </span>
                        <CopyButton valueToCopy={command} />
                      </div>
                      <Input
                        disabled
                        value={command.slice(0, 500)}
                        onFocus={(evt) => {
                          evt.target.select()
                        }}
                      />
                    </div>
                  )
                } else {
                  // remove command
                  return (
                    <div
                      key={item.key}
                      className="absolute top-0 left-0 w-full"
                      style={{
                        height: item.size,
                        transform: `translateY(${item.start}px)`,
                      }}
                    >
                      <div className="flex flex-row items-center">
                        <span className="grow">
                          {t(
                            ($) =>
                              $.dialog.exportToMinecraft.result.removeCommand,
                          )}
                        </span>
                        <CopyButton valueToCopy={removeCommand} />
                      </div>
                      <Input
                        disabled
                        value={removeCommand.slice(0, 500)}
                        onFocus={(evt) => {
                          evt.target.select()
                        }}
                      />
                    </div>
                  )
                }
              })}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="datapack" className="flex flex-col gap-2">
          <FieldSet>
            <FieldLegend>
              {t(($) => $.dialog.exportToMinecraft.datapack.options.title)}
            </FieldLegend>

            <FieldGroup>
              <DatapackNamespaceField
                onChange={(newNamespace) => setNamespace(newNamespace)}
              />

              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel>
                    {t(
                      ($) =>
                        $.dialog.exportToMinecraft.datapack.options.compress
                          .name,
                    )}
                  </FieldLabel>
                  <FieldDescription>
                    {t(
                      ($) =>
                        $.dialog.exportToMinecraft.datapack.options.compress
                          .desc,
                    )}
                  </FieldDescription>
                </FieldContent>
                <Switch
                  checked={compressDatapack}
                  onCheckedChange={(checked) => setCompressDatapack(checked)}
                />
              </Field>
            </FieldGroup>
          </FieldSet>

          <div>
            <FieldLegend>
              {t(($) => $.dialog.exportToMinecraft.datapack.howToUse.title)}
            </FieldLegend>
            <div>
              {t(($) => $.dialog.exportToMinecraft.datapack.howToUse.desc)}
            </div>
            <ul className="list-disc pl-4">
              <li>
                <Trans
                  i18nKey={($) =>
                    $.dialog.exportToMinecraft.datapack.howToUse.summonCommand
                  }
                  components={{
                    codeblock: <code className="text-neutral-500" />,
                  }}
                  values={{
                    command: `/function ${datapackOptions.namespace}:summon`,
                  }}
                />
              </li>
              <li>
                <Trans
                  i18nKey={($) =>
                    $.dialog.exportToMinecraft.datapack.howToUse.removeCommand
                  }
                  components={{
                    codeblock: <code className="text-neutral-500" />,
                  }}
                  values={{
                    command: `/function ${datapackOptions.namespace}:remove`,
                  }}
                />
              </li>
            </ul>
          </div>

          <Button
            onClick={() => {
              downloadAsDatapack(
                {
                  summon: summonCommands,
                  remove: [removeCommand],
                },
                { ...datapackOptions, gameVersion: targetGameVersion },
              )
                .then(() => {
                  toast.success(
                    t(($) => $.dialog.exportToMinecraft.datapack.exportSuccess),
                  )
                })
                .catch(console.error)
            }}
          >
            {t(($) => $.dialog.exportToMinecraft.datapack.downloadButton)}
          </Button>
        </TabsContent>
      </Tabs>
    </Dialog>
  )
}

function downloadAsMcfunction(commands: string[]) {
  const fullstr = commands.join('\n')
  const blob = new Blob([fullstr], { type: 'application/octet-stream' }) // prevent chrome mobile from downloading as `filename.mcfunction.txt`

  downloadFile(blob, 'summon.mcfunction')
}

async function downloadAsDatapack(
  commands: {
    summon: string[]
    remove: string[]
  },
  options: {
    namespace: string
    compress: boolean
    gameVersion: string
  },
) {
  const gameVersionData = GameVersions.find(
    (ver) => ver.id === options.gameVersion,
  )
  if (gameVersionData == null) {
    throw new Error('Invalid game version id')
  }

  const zip = new JSZip()
  zip.file(
    'pack.mcmeta',
    JSON.stringify(
      {
        pack: {
          description: '',
          pack_format: gameVersionData.datapackVersion,
        },
      },
      null,
      2,
    ),
  )

  zip.file(
    `data/function/${options.namespace}/summon.mcfunction`,
    commands.summon.join('\n'),
  )
  zip.file(
    `data/function/${options.namespace}/remove.mcfunction`,
    commands.remove.join('\n'),
  )

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: options.compress ? 'DEFLATE' : 'STORE',
  })
  downloadFile(blob, 'datapack.zip')
}

export default ExportToMinecraftDialog
