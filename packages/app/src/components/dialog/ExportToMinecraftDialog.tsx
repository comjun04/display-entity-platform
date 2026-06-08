import { useDebouncedEffect } from '@react-hookz/web'
import { useVirtualizer } from '@tanstack/react-virtual'
import JSZip from 'jszip'
import mojangson, { type MojangsonList } from 'mojangson'
import {
  type ComponentPropsWithoutRef,
  type FC,
  useEffect,
  useState,
} from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { LuCircleSlash, LuCopy, LuCopyCheck } from 'react-icons/lu'
import { coerce as semverCoerce, satisfies as semverSatisfies } from 'semver'
import { toast } from 'sonner'
import { useShallow } from 'zustand/shallow'

import { GameVersions } from '@/constants'
import { getLogger } from '@/lib/logger'
import { downloadFile } from '@/lib/utils'
import { useDialogStore } from '@/stores/dialogStore'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEntityRefStore } from '@/stores/entityRefStore'
import { useProjectStore } from '@/stores/projectStore'
import type {
  DisplayEntity,
  MinimalTextureValue,
  TextEffects,
} from '@/types/base'
import { isItemDisplayPlayerHead } from '@/types/guards'

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

const logger = getLogger('ExportToMinecraftDialog')

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
  const [nbtDataGenerated, setNbtDataGenerated] = useState(false)
  const [nbtStrings, setNbtStrings] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      setBaseTag('')
    }
  }, [isOpen])

  // 엔티티 데이터나 태그가 바뀌었다면 커맨드를 다시 생성해야 함
  useEffect(() => {
    setNbtDataGenerated(false)
  }, [entities, baseTag, mainNBT, targetGameVersion])

  useEffect(() => {
    if (!nbtDataGenerated && isOpen) {
      const newNbtStrings = generateNbtStrings(
        entities,
        targetGameVersion,
        baseTag,
        mainNBT,
      )

      setNbtStrings(newNbtStrings)
      setNbtDataGenerated(true)
    }
  }, [nbtDataGenerated, isOpen, baseTag, mainNBT, entities, targetGameVersion])

  const summonCommands = nbtStrings.map(
    (nbt) => `/summon block_display ~ ~ ~ ${nbt}`,
  )
  const removeCommand = `/kill @e[${baseTag.length > 0 ? `tag=${baseTag}` : 'type=block_display'},distance=..2]`

  const [commandListParentRef, setCommandListParentRef] =
    useState<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: summonCommands.length + 1,
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
            className="overflow-y-auto"
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

function generateNbtStrings(
  entities: Map<string, DisplayEntity>,
  targetGameVersion: string,
  baseTag: string = '',
  mainNBT: string = '',
): string[] {
  const { entityRefs } = useEntityRefStore.getState()

  const semveredGameVersion = semverCoerce(targetGameVersion)?.version
  if (semveredGameVersion == null) {
    console.error('semveredGameVersion is null, this should not happen')
    return []
  }

  // whether item uses data component instead of nbt
  const isItemDataComponentEnabled = semverSatisfies(
    semveredGameVersion,
    '>=1.20.5',
  )
  // whether text is represented as SNBT rather than JSON
  const isTextFormatSNBT = semverSatisfies(semveredGameVersion, '>=1.21.5')

  const passengersStrings = [...entities.values()]
    .map((entity) => {
      // 그룹은 커맨드 생성에 들어가지 않음
      // 그룹 안에 있는 엔티티들은 world transform으로 반영됨
      if (entity.kind === 'group') return

      const refData = entityRefs.get(entity.id)
      if (refData == null || refData.objectRef.current == null) {
        logger.warn(`entity ref of entity ${entity.id} not found, ignoring.`)
        return
      }

      const worldMatrix = refData.objectRef.current.matrixWorld

      const idText = entity.kind + '_display' // block_display, item_display, text_display
      const transformationString = worldMatrix
        .clone()
        .transpose()
        .toArray()
        .map((num) => Math.round(num * 1_0000_0000) / 1_0000_0000 + 'f')
        .join(',')

      let specificData = ''
      if (entity.kind === 'block') {
        const propertiesText = Object.entries(entity.blockstates)
          .map(([k, v]) => `${k}:"${v}"`)
          .join(',')

        specificData = `block_state:{Name:"${entity.type}",Properties:{${propertiesText}}}`
      } else if (entity.kind === 'item') {
        const displayText =
          entity.display != null ? `,item_display:"${entity.display}"` : ''

        let itemExtraData = ''
        if (isItemDisplayPlayerHead(entity)) {
          const textureData = entity.playerHeadProperties.texture
          if (textureData?.baked) {
            const o = {
              textures: {
                SKIN: {
                  url: textureData.url,
                },
              },
            } satisfies MinimalTextureValue
            const textureValueString = btoa(JSON.stringify(o))
            itemExtraData = isItemDataComponentEnabled
              ? `,components:{"minecraft:profile":{properties:[{name:"textures",value:"${textureValueString}"}]}}`
              : `,SkullOwner:{Properties:{textures:[{Value:"${textureValueString}"}]}}`
          }
        }
        specificData = `item:{id:"${entity.type}"${itemExtraData}}${displayText}`
      } else if (entity.kind === 'text') {
        // text
        const text = entity.text
          .replaceAll('\\', '\\\\')
          .replaceAll('\n', isTextFormatSNBT ? '\\n' : '\\\\n')
          .replaceAll('"', '\\"')
        const enabledTextEffects = (
          Object.keys(entity.textEffects) as Array<keyof TextEffects>
        ).filter((k) => entity.textEffects[k])
        const enabledTextEffectsString =
          enabledTextEffects.length > 0
            ? ',' +
              enabledTextEffects
                .map((k) => (isTextFormatSNBT ? `${k}:true` : `"${k}":true`))
                .join(',')
            : ''
        specificData = isTextFormatSNBT
          ? `text:{text:"${text}"${enabledTextEffectsString},color:"#${entity.textColor.toString(16)}"}`
          : `text:'{"text":"${text}"${enabledTextEffectsString},"color":"#${entity.textColor.toString(16)}"}'`

        // TODO: omit optional nbt data if data value is default value

        // alignment
        specificData += `,alignment:"${entity.alignment}"`
        // background_color
        specificData += `,background_color:${entity.backgroundColor}`
        // default_background
        if (entity.defaultBackground) {
          specificData += ',default_background:true'
        }
        // line_width
        specificData += `,line_width:${entity.lineWidth}`
        // see_through
        if (entity.seeThrough) {
          specificData += ',see_through:true'
        }
        // shadow
        if (entity.shadow) {
          specificData += ',shadow:true'
        }
        // text_opacity
        specificData += `,text_opacity:${entity.textOpacity}`
      }

      const generatedString = `{id:"${idText}",${specificData},transformation:[${transformationString}]}${entity.nbt.length > 0 ? ',' + entity.nbt : ''}`

      // attempt to inject baseTag
      const finalString = injectBaseTag(generatedString, baseTag, true)

      return finalString
    })
    .filter((d) => d != null)

  let le = Infinity
  const groupedPassengersStrings: string[] = []
  for (const passengersStr of passengersStrings) {
    // 32500 (max command length in command block) - 60 (length of `/summon block_display ~ ~ ~ {Tags:[""],Passengers:[]}` + alpha) - baseTag length
    if (le + passengersStr.length > 32440 - baseTag.length) {
      groupedPassengersStrings.push(passengersStr)
      le = passengersStr.length + 1
    } else {
      groupedPassengersStrings[groupedPassengersStrings.length - 1] +=
        ',' + passengersStr
      le += passengersStr.length + 1
    }
  }

  const tagInjectedMainNBT = injectBaseTag(mainNBT, baseTag, false)

  // TODO: remove tagString and replace with tag injection
  const newNbtStrings = groupedPassengersStrings.map(
    (str) =>
      `{Passengers:[${str}]${tagInjectedMainNBT.length > 0 ? ',' + tagInjectedMainNBT : ''}}`,
  )

  return newNbtStrings
}

function injectBaseTag(
  nbtString: string,
  baseTag: string,
  wrapWithBraces = false,
) {
  // If baseTag is empty, do nothing
  if (baseTag.length < 1) return nbtString
  // If nbt string is empty, create a new one
  if (nbtString.length < 1) {
    const tagString = `Tags:["${baseTag}"]`
    return wrapWithBraces ? `{${tagString}}` : tagString
  }

  // If nbt string does not wrapped with curly brackets, wrap it
  // This is necesseary to make it parsable with mojangson
  if (!nbtString.startsWith('{')) nbtString = '{' + nbtString
  if (!nbtString.endsWith('}')) nbtString += '}'

  const parsedData = mojangson.parse(nbtString)
  if (parsedData?.type !== 'compound') {
    logger.warn(
      'Failed to parse generated entity nbt string, skipping baseTag injection',
    )
    return nbtString
  }

  const tagListNode = parsedData.value['Tags']
  if (tagListNode?.type !== 'list') {
    parsedData.value['Tags'] = {
      type: 'list',
      value: {
        type: 'string',
        value: [baseTag],
      },
    } satisfies MojangsonList
  } else {
    tagListNode.value.value.push(baseTag)
  }

  const injected = mojangson.stringify(parsedData)
  return wrapWithBraces ? injected : injected.slice(1, -1)
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
