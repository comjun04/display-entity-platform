import { useDebouncedEffect } from '@react-hookz/web'
import { type FC, type JSX, useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { LuCircleSlash, LuCopy, LuCopyCheck } from 'react-icons/lu'
import { coerce as semverCoerce, satisfies as semverSatisfies } from 'semver'
import { useShallow } from 'zustand/shallow'

import { getLogger } from '@/lib/logger'
import { cn } from '@/lib/utils'
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
import { Input } from '../ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Textarea } from '../ui/textarea'
import Dialog from './Dialog'

const logger = getLogger('ExportToMinecraftDialog')

type CopyButtonProps = JSX.IntrinsicElements['button'] & {
  valueToCopy: string
}

const CopyButton: FC<CopyButtonProps> = ({
  className,
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
    <button
      className={cn(
        'flex flex-row items-center gap-2 rounded-lg bg-white/10 px-3 py-1 transition hover:bg-white/5',
        className,
      )}
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
    </button>
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
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="flex-none">
          {t(($) => $.dialog.exportToMinecraft.baseTag.title)}
        </span>
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
      </div>

      {hasValidationErrors && (
        <span className="text-sm text-red-500">
          <Trans
            i18nKey={($) => $.dialog.exportToMinecraft.baseTag.invalidTagNotice}
            ns="translation"
          >
            Tag must contain only alphabets, numbers,{' '}
            <code className="rounded-sm bg-neutral-800 p-1 font-mono">_</code>,{' '}
            <code className="rounded-sm bg-neutral-800 p-1 font-mono">-</code>,{' '}
            <code className="rounded-sm bg-neutral-800 p-1 font-mono">.</code>,
            and{' '}
            <code className="rounded-sm bg-neutral-800 p-1 font-mono">+</code>{' '}
            characters.
          </Trans>
        </span>
      )}
    </div>
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

  const targetGameVersion = useProjectStore((state) => state.targetGameVersion)

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
  }, [entities, baseTag, targetGameVersion])

  useEffect(() => {
    if (!nbtDataGenerated && isOpen) {
      const newNbtStrings = generateNbtStrings(
        entities,
        targetGameVersion,
        baseTag,
      )

      setNbtStrings(newNbtStrings)
      setNbtDataGenerated(true)
    }
  }, [nbtDataGenerated, isOpen, baseTag, entities, targetGameVersion])

  const summonCommands = nbtStrings.map(
    (nbt) => `/summon block_display ~ ~ ~ ${nbt}`,
  )
  const removeCommand = `/kill @e[${baseTag.length > 0 ? `tag=${baseTag}` : 'type=block_display'},distance=..2]`

  return (
    <Dialog
      title={t(($) => $.dialog.exportToMinecraft.title)}
      open={isOpen}
      onClose={closeActiveDialog}
    >
      <div className="rounded-lg bg-neutral-700 p-2">
        <TagValidatorInput onChange={setBaseTag} />
      </div>

      <Tabs defaultValue="command" className="h-full">
        <TabsList>
          <TabsTrigger value="command">Commands</TabsTrigger>
          <TabsTrigger value="datapack">Data Pack</TabsTrigger>
        </TabsList>

        <TabsContent value="command" className="flex flex-col gap-2">
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

          <div className="overflow-y-auto">
            {summonCommands.map((command, idx) => (
              <div key={idx}>
                <div className="flex flex-row items-center">
                  <span className="grow">
                    {t(($) => $.dialog.exportToMinecraft.result.summonCommand, {
                      n: idx + 1,
                    })}
                  </span>
                  <CopyButton valueToCopy={command} />
                </div>
                <Textarea
                  className="h-18 resize-none"
                  readOnly
                  value={command}
                  onFocus={(evt) => {
                    evt.target.select()
                  }}
                />
              </div>
            ))}

            {nbtStrings.length > 0 && (
              <div>
                <div className="flex flex-row items-center">
                  <span className="grow">
                    {t(($) => $.dialog.exportToMinecraft.result.removeCommand)}
                  </span>
                  <CopyButton valueToCopy={removeCommand} />
                </div>
                <Textarea
                  className="h-18 resize-none"
                  readOnly
                  value={removeCommand}
                  onFocus={(evt) => {
                    evt.target.select()
                  }}
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Dialog>
  )
}

function generateNbtStrings(
  entities: Map<string, DisplayEntity>,
  targetGameVersion: string,
  baseTag: string = '',
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

  const tagString = baseTag.length > 0 ? `Tags:["${baseTag}"],` : ''
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

      return `{id:"${idText}",${tagString}${specificData},transformation:[${transformationString}]}`
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

  const newNbtStrings = groupedPassengersStrings.map(
    (str) => `{${tagString}Passengers:[${str}]}`,
  )

  return newNbtStrings
}

function downloadAsMcfunction(commands: string[]) {
  const fullstr = commands.join('\n')
  const blob = new Blob([fullstr], { type: 'application/octet-stream' }) // prevent chrome mobile from downloading as `filename.mcfunction.txt`
  const objectUrl = URL.createObjectURL(blob)

  const tempElement = document.createElement('a')
  tempElement.href = objectUrl
  tempElement.download = 'summon.mcfunction'
  tempElement.click() // triggers download

  URL.revokeObjectURL(objectUrl)
}

export default ExportToMinecraftDialog
