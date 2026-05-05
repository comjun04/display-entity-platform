import { type FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LuBold,
  LuItalic,
  LuShuffle,
  LuStrikethrough,
  LuUnderline,
} from 'react-icons/lu'
import { useShallow } from 'zustand/shallow'

import { BackendHost, GameVersions } from '@/constants'
import useBlockStates from '@/hooks/useBlockStates'
import { setBDEntityBlockstates, setIDEntityDisplayType } from '@/lib/entities'
import { cn, isValidTextureUrl } from '@/lib/utils'
import { useDialogStore } from '@/stores/dialogStore'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useProjectStore } from '@/stores/projectStore'
import type {
  BackendAPIV1GetPlayerSkinResponse,
  ModelDisplayPositionKey,
  TextDisplayAlignment,
} from '@/types/base'
import { isItemDisplayPlayerHead } from '@/types/guards'

import { SidePanel, SidePanelContent, SidePanelTitle } from '../SidePanel'
import { ColorPickerInput } from '../ui/ColorPicker'
import { Switch } from '../ui/switch'

const displayValue: (ModelDisplayPositionKey | null)[] = [
  null,
  'ground',
  'head',
  'firstperson_righthand',
  'firstperson_lefthand',
  'thirdperson_righthand',
  'thirdperson_lefthand',
  'gui',
  'fixed',
]

const BlockDisplayProperties: FC = () => {
  const singleSelectedEntity = useDisplayEntityStore((state) => {
    const entity =
      state.selectedEntityIds.length === 1
        ? state.entities.get(state.selectedEntityIds[0])!
        : null
    return entity?.kind === 'block' ? entity : null
  })

  const { data: blockstatesData } = useBlockStates(singleSelectedEntity?.type)

  if (
    singleSelectedEntity == null ||
    blockstatesData == null ||
    blockstatesData.blockstates.size < 1
  ) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-sm bg-neutral-700 p-1 px-2 text-xs font-bold text-neutral-400">
        Blockstates
      </div>
      {[...blockstatesData.blockstates.entries()].map(([key, values]) => {
        return (
          <div key={key} className="flex flex-row items-center gap-2">
            <label className="flex-1 text-end">{key}</label>
            <select
              className="flex-1 rounded-sm bg-neutral-800 px-2 py-1"
              value={singleSelectedEntity.blockstates[key]}
              onChange={(evt) => {
                setBDEntityBlockstates(singleSelectedEntity.id, {
                  [key]: evt.target.value,
                })
              }}
            >
              {[...values.states.values()].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}

const ItemDisplayProperties: FC = () => {
  const { t } = useTranslation()

  const singleSelectedEntity = useDisplayEntityStore((state) => {
    const entity =
      state.selectedEntityIds.length === 1
        ? state.entities.get(state.selectedEntityIds[0])!
        : null
    return entity?.kind === 'item' ? entity : null
  })

  const [tempPlayerHeadTextureUrl, setTempPlayerHeadTextureUrl] = useState(
    singleSelectedEntity != null &&
      isItemDisplayPlayerHead(singleSelectedEntity) &&
      singleSelectedEntity.playerHeadProperties.texture?.baked
      ? singleSelectedEntity.playerHeadProperties.texture.url
      : undefined,
  )
  const [tempPlayerName, setTempPlayerName] = useState('')

  if (singleSelectedEntity == null) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-sm bg-neutral-700 p-1 px-2 text-xs font-bold text-neutral-400">
        {t(($) => $.sidebar.propertiesPanel.sections.display)}
      </div>

      <div className="flex flex-row items-center gap-2">
        <label className="flex-1 text-end">display</label>
        <select
          className="flex-1 rounded-sm bg-neutral-800 px-2 py-1"
          value={singleSelectedEntity.display ?? 'none'}
          onChange={(evt) => {
            setIDEntityDisplayType(
              singleSelectedEntity.id,
              evt.target.value === 'none'
                ? null
                : (evt.target.value as ModelDisplayPositionKey),
            )
          }}
        >
          {displayValue.map((value) => (
            <option key={value ?? 'none'} value={value ?? 'none'}>
              {value ?? 'none'}
            </option>
          ))}
        </select>
      </div>

      {isItemDisplayPlayerHead(singleSelectedEntity) && (
        <>
          <div className="rounded-sm bg-neutral-700 p-1 px-2 text-xs font-bold text-neutral-400">
            {t(($) => $.sidebar.propertiesPanel.sections.textures.title)}
          </div>
          <div className="flex flex-row items-center gap-2">
            <label className="flex-none text-end">
              {t(
                ($) =>
                  $.sidebar.propertiesPanel.sections.textures.properties
                    .textureUrl.title,
              )}
            </label>
            <input
              className="min-w-0 shrink rounded-sm bg-neutral-800 py-1 pl-1 text-xs outline-hidden"
              value={tempPlayerHeadTextureUrl}
              onChange={(evt) => {
                setTempPlayerHeadTextureUrl(evt.target.value)
              }}
            />

            <button
              className="rounded-sm bg-neutral-800 p-1 text-xs"
              onClick={() => {
                if (tempPlayerHeadTextureUrl == null) {
                  return
                }
                if (!isValidTextureUrl(tempPlayerHeadTextureUrl)) {
                  console.error(
                    `Unsupported texture url ${tempPlayerHeadTextureUrl}`,
                  )
                  return
                }

                useDisplayEntityStore
                  .getState()
                  .setItemDisplayPlayerHeadProperties(singleSelectedEntity.id, {
                    texture: {
                      baked: true,
                      url: tempPlayerHeadTextureUrl,
                    },
                  })
              }}
            >
              {t(
                ($) =>
                  $.sidebar.propertiesPanel.sections.textures.properties
                    .textureUrl.applyBtn,
              )}
            </button>
          </div>
          <div className="flex flex-row items-center gap-2">
            <label className="flex-none text-end">
              {t(
                ($) =>
                  $.sidebar.propertiesPanel.sections.textures.properties
                    .playerUsername.title,
              )}
            </label>
            <input
              className="min-w-0 shrink rounded-sm bg-neutral-800 py-1 pl-1 text-xs outline-hidden"
              maxLength={16}
              onChange={(evt) => {
                const str = evt.target.value
                if (str.length <= 16) {
                  setTempPlayerName(str)
                }
              }}
            />

            <button
              className="rounded-sm bg-neutral-800 p-1 text-xs"
              onClick={() => {
                if (tempPlayerName.length < 3 || tempPlayerName.length > 16) {
                  return
                }

                const asyncFn = async () => {
                  const skinQueryResponse = (await fetch(
                    `${BackendHost}/v1/skin/${tempPlayerName}`,
                  )
                    .then((res) => res.json())
                    .catch(console.error)) as BackendAPIV1GetPlayerSkinResponse

                  const textureUrl = skinQueryResponse.skinUrl
                  if (textureUrl == null) {
                    console.error(
                      `Minecraft user ${skinQueryResponse.name} does not have a skin`,
                    )
                    return
                  } else if (!isValidTextureUrl(textureUrl)) {
                    console.error(
                      `Unsupported texture url ${textureUrl}. This should not happen`,
                    )
                    return
                  }

                  setTempPlayerHeadTextureUrl(textureUrl)
                  useDisplayEntityStore
                    .getState()
                    .setItemDisplayPlayerHeadProperties(
                      singleSelectedEntity.id,
                      {
                        texture: {
                          baked: true,
                          url: textureUrl,
                        },
                      },
                    )
                }

                asyncFn().catch(console.error)
              }}
            >
              {t(
                ($) =>
                  $.sidebar.propertiesPanel.sections.textures.properties
                    .playerUsername.loadBtn,
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const TextDisplayProperties: FC = () => {
  const { t } = useTranslation()

  const singleSelectedEntity = useDisplayEntityStore((state) => {
    const entity =
      state.selectedEntityIds.length === 1
        ? state.entities.get(state.selectedEntityIds[0])!
        : null
    return entity?.kind === 'text' ? entity : null
  })

  if (singleSelectedEntity == null) return null

  const { textEffects } = singleSelectedEntity

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-sm bg-neutral-700 p-1 px-2 text-xs font-bold text-neutral-400">
        {t(($) => $.sidebar.propertiesPanel.sections.text)}
      </div>

      <div className="flex flex-row items-center gap-2">
        <label className="flex-1 text-end">text</label>
        <textarea
          className="min-h-24 min-w-0 flex-1 rounded-sm bg-neutral-800 py-1 pl-1 text-xs outline-hidden"
          value={singleSelectedEntity.text}
          onChange={(evt) => {
            useDisplayEntityStore
              .getState()
              .setTextDisplayProperties(singleSelectedEntity.id, {
                text: evt.target.value,
              })
          }}
        />
      </div>
      <div className="flex flex-row items-center gap-2">
        <label className="flex-1 text-end">text color</label>
        <ColorPickerInput
          className="flex-1"
          mode="rgb"
          value={singleSelectedEntity.textColor}
          onValueChange={(num) => {
            useDisplayEntityStore
              .getState()
              .setTextDisplayProperties(singleSelectedEntity.id, {
                textColor: num,
              })
          }}
        />
      </div>
      <div className="flex flex-row items-center gap-2">
        <label className="flex-1 text-end">line_width</label>
        <input
          type="number"
          min={0}
          className="min-w-0 flex-1 rounded-sm bg-neutral-800 py-1 pl-1 text-xs outline-hidden"
          value={singleSelectedEntity.lineWidth}
          onChange={(evt) => {
            const value = parseInt(evt.target.value)
            if (!isFinite(value) || value < 0) return

            useDisplayEntityStore
              .getState()
              .setTextDisplayProperties(singleSelectedEntity.id, {
                lineWidth: value,
              })
          }}
        />
      </div>
      <div className="flex flex-row items-center gap-2">
        <label className="flex-1 text-end">alignment</label>
        <select
          className="flex-1 rounded-sm bg-neutral-800 px-2 py-1"
          value={singleSelectedEntity.alignment}
          onChange={(evt) => {
            useDisplayEntityStore
              .getState()
              .setTextDisplayProperties(singleSelectedEntity.id, {
                alignment: evt.target.value as TextDisplayAlignment,
              })
          }}
        >
          <option>left</option>
          <option>center</option>
          <option>right</option>
        </select>
      </div>

      <div className="flex flex-row items-center gap-2">
        <label className="flex-1 text-end">background_color</label>
        <ColorPickerInput
          className="flex-1"
          mode="argb"
          value={singleSelectedEntity.backgroundColor}
          onValueChange={(num) => {
            useDisplayEntityStore
              .getState()
              .setTextDisplayProperties(singleSelectedEntity.id, {
                backgroundColor: num,
              })
          }}
        />
      </div>
      <div className="flex flex-row items-center gap-2">
        <label className="flex-1 text-end">default_background</label>
        <div className="flex flex-1 flex-col justify-center">
          <Switch
            checked={singleSelectedEntity.defaultBackground}
            onCheckedChange={(value) => {
              useDisplayEntityStore
                .getState()
                .setTextDisplayProperties(singleSelectedEntity.id, {
                  defaultBackground: value,
                })
            }}
          />
        </div>
      </div>
      <div className="flex flex-row items-center gap-2">
        <label className="flex-1 text-end">see_through</label>
        <div className="flex flex-1 flex-col justify-center">
          <Switch
            checked={singleSelectedEntity.seeThrough}
            onCheckedChange={(value) => {
              useDisplayEntityStore
                .getState()
                .setTextDisplayProperties(singleSelectedEntity.id, {
                  seeThrough: value,
                })
            }}
          />
        </div>
      </div>
      <div className="flex flex-row items-center gap-2">
        <label className="flex-1 text-end">shadow</label>
        <div className="flex flex-1 flex-col justify-center">
          <Switch
            checked={singleSelectedEntity.shadow}
            onCheckedChange={(value) => {
              useDisplayEntityStore
                .getState()
                .setTextDisplayProperties(singleSelectedEntity.id, {
                  shadow: value,
                })
            }}
          />
        </div>
      </div>
      <div className="flex flex-row items-center gap-2">
        <label className="flex-1 text-end">text_opacity</label>
        <input
          type="number"
          min={0}
          max={255}
          className="min-w-0 flex-1 rounded-sm bg-neutral-800 py-1 pl-1 text-xs outline-hidden"
          value={singleSelectedEntity.textOpacity}
          onChange={(evt) => {
            const value = parseInt(evt.target.value)
            if (!isFinite(value) || value < 0 || value > 255) return

            useDisplayEntityStore
              .getState()
              .setTextDisplayProperties(singleSelectedEntity.id, {
                textOpacity: value,
              })
          }}
        />
      </div>

      <div className="rounded-sm bg-neutral-700 p-1 px-2 text-xs font-bold text-neutral-400">
        {t(($) => $.sidebar.propertiesPanel.sections.textEffects)}
      </div>
      <div className="flex w-full flex-row gap-1 rounded-sm bg-neutral-800 p-1">
        <button
          className={cn(
            'flex grow flex-row justify-center rounded-sm p-1 transition duration-150',
            textEffects.bold && 'bg-white/30',
          )}
          onClick={() =>
            useDisplayEntityStore
              .getState()
              .setTextDisplayProperties(singleSelectedEntity.id, {
                textEffects: {
                  bold: !textEffects.bold,
                },
              })
          }
        >
          <LuBold size={24} />
        </button>
        <button
          className={cn(
            'flex grow flex-row justify-center rounded-sm p-1 transition duration-150',
            textEffects.italic && 'bg-white/30',
          )}
          onClick={() =>
            useDisplayEntityStore
              .getState()
              .setTextDisplayProperties(singleSelectedEntity.id, {
                textEffects: {
                  italic: !textEffects.italic,
                },
              })
          }
        >
          <LuItalic size={24} />
        </button>
        <button
          className={cn(
            'flex grow flex-row justify-center rounded-sm p-1 transition duration-150',
            textEffects.underlined && 'bg-white/30',
          )}
          onClick={() =>
            useDisplayEntityStore
              .getState()
              .setTextDisplayProperties(singleSelectedEntity.id, {
                textEffects: {
                  underlined: !textEffects.underlined,
                },
              })
          }
        >
          <LuUnderline size={24} />
        </button>
        <button
          className={cn(
            'flex grow flex-row justify-center rounded-sm p-1 transition duration-150',
            textEffects.strikethrough && 'bg-white/30',
          )}
          onClick={() =>
            useDisplayEntityStore
              .getState()
              .setTextDisplayProperties(singleSelectedEntity.id, {
                textEffects: {
                  strikethrough: !textEffects.strikethrough,
                },
              })
          }
        >
          <LuStrikethrough size={24} />
        </button>
        <button
          className={cn(
            'flex grow flex-row justify-center rounded-sm p-1 transition duration-150',
            textEffects.obfuscated && 'bg-white/30',
          )}
          onClick={() =>
            useDisplayEntityStore
              .getState()
              .setTextDisplayProperties(singleSelectedEntity.id, {
                textEffects: {
                  obfuscated: !textEffects.obfuscated,
                },
              })
          }
        >
          <LuShuffle size={24} />
        </button>
      </div>
    </div>
  )
}

const GroupProperties: FC = () => {
  const { t } = useTranslation()

  const singleSelectedEntity = useDisplayEntityStore((state) => {
    const entity =
      state.selectedEntityIds.length === 1
        ? state.entities.get(state.selectedEntityIds[0])!
        : null
    return entity?.kind === 'group' ? entity : null
  })

  if (singleSelectedEntity == null) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-sm bg-neutral-700 p-1 px-2 text-xs font-bold text-neutral-400">
        {t(($) => $.sidebar.propertiesPanel.sections.group.title)}
      </div>

      <div className="flex flex-row items-center gap-2">
        <label className="flex-1 text-end">
          {t(
            ($) =>
              $.sidebar.propertiesPanel.sections.group.properties.groupName
                .title,
          )}
        </label>
        <input
          className="min-w-0 flex-1 shrink rounded-sm bg-neutral-800 py-1 pl-1 text-xs outline-hidden"
          value={singleSelectedEntity.name}
          onChange={(evt) => {
            useDisplayEntityStore
              .getState()
              .setGroupName(singleSelectedEntity.id, evt.target.value)
          }}
        />
      </div>
    </div>
  )
}

const ProjectProperties: FC = () => {
  const { t } = useTranslation()

  const { targetGameVersion, projectName, setProjectName } = useProjectStore(
    useShallow((state) => ({
      targetGameVersion: state.targetGameVersion,
      projectName: state.projectName,
      setProjectName: state.setProjectName,
    })),
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-sm bg-neutral-700 p-1 px-2 text-xs font-bold text-neutral-400">
        {t(($) => $.sidebar.propertiesPanel.sections.project.title)}
      </div>

      <div className="flex flex-row items-center gap-2">
        <label className="flex-1">
          {t(
            ($) =>
              $.sidebar.propertiesPanel.sections.project.properties.projectName
                .title,
          )}
        </label>
        <input
          className="min-w-0 flex-1 shrink rounded-sm bg-neutral-800 py-1 pl-1 text-xs outline-hidden"
          value={projectName}
          onChange={(evt) => {
            setProjectName(evt.target.value)
          }}
        />
      </div>

      <div className="flex flex-row items-center gap-2">
        <label className="flex-1">
          {t(
            ($) =>
              $.sidebar.propertiesPanel.sections.project.properties
                .targetMinecraftVersion.title,
          )}
        </label>
        <select
          className="flex-1 rounded-sm bg-neutral-800 px-2 py-1"
          value={targetGameVersion}
          onChange={(evt) => {
            const gameVersionData = GameVersions.find(
              (v) => v.id === evt.target.value,
            )!

            useDialogStore
              .getState()
              .confirmModal({
                title: t(
                  ($) => $.dialog.prompt.changeTargetMinecraftVersion.title,
                ),
                content: t(
                  ($) => $.dialog.prompt.changeTargetMinecraftVersion.content,
                  {
                    newVersionLabel: gameVersionData.label,
                  },
                ),
                buttonText: {
                  positive: t(
                    ($) =>
                      $.dialog.prompt.changeTargetMinecraftVersion.button.yes,
                  ),
                  negative: t(
                    ($) =>
                      $.dialog.prompt.changeTargetMinecraftVersion.button.no,
                  ),
                },
              })
              .then((choice) => {
                if (choice) {
                  useProjectStore
                    .getState()
                    .setTargetGameVersion(gameVersionData.id)
                  useDisplayEntityStore
                    .getState()
                    .purgeInvalidEntities()
                    .catch(console.error)
                  useHistoryStore.getState().clearHistory()
                }
              })
              .catch(console.error)
          }}
        >
          {GameVersions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

const PropertiesPanel: FC = () => {
  const { t } = useTranslation()

  const { singleSelectedEntity } = useDisplayEntityStore(
    useShallow((state) => {
      return {
        singleSelectedEntity:
          state.selectedEntityIds.length === 1
            ? state.entities.get(state.selectedEntityIds[0])!
            : null,
      }
    }),
  )

  return (
    <SidePanel>
      <SidePanelTitle>
        {t(($) => $.sidebar.propertiesPanel.title)}
      </SidePanelTitle>
      <SidePanelContent>
        {singleSelectedEntity?.kind === 'block' && <BlockDisplayProperties />}
        {singleSelectedEntity?.kind === 'item' && <ItemDisplayProperties />}
        {singleSelectedEntity?.kind === 'text' && <TextDisplayProperties />}
        {singleSelectedEntity?.kind === 'group' && <GroupProperties />}

        {singleSelectedEntity == null && <ProjectProperties />}
      </SidePanelContent>
    </SidePanel>
  )
}

export default PropertiesPanel
