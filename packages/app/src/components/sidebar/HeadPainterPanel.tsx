import { type FC } from 'react'
import { useShallow } from 'zustand/shallow'

import { cn } from '@/lib/utils'
import { useDialogStore } from '@/stores/dialogStore'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import { isItemDisplayPlayerHead } from '@/types/guards'

import { SidePanel, SidePanelContent, SidePanelTitle } from '../SidePanel'
import { ColorPickerInput } from '../ui/ColorPicker'

const HeadPainterPanel: FC = () => {
  const { brushColor, layer, mineskinApiKeyFilled } = useEditorStore(
    useShallow((state) => ({
      brushColor: state.headPainter.brushColor,
      layer: state.headPainter.layer,
      mineskinApiKeyFilled:
        state.settings.headPainter.mineskinApiKey.length > 0,
    })),
  )
  const unbakedHeadsCount = useDisplayEntityStore((state) => {
    let count = 0
    for (const entity of state.entities.values()) {
      if (
        isItemDisplayPlayerHead(entity) &&
        entity.playerHeadProperties.texture?.baked === false
      ) {
        count++
      }
    }

    return count
  })

  return (
    <SidePanel>
      <SidePanelTitle>Head Painter</SidePanelTitle>
      <SidePanelContent>
        <div className="flex flex-col gap-2">
          <div className="rounded-sm bg-neutral-700 p-1 px-2 text-xs font-bold text-neutral-400">
            Paint
          </div>
          <div className="flex flex-row items-center gap-2">
            <label className="flex-1 text-end">Brush Color</label>
            <ColorPickerInput
              className="flex-1"
              mode="rgb"
              value={brushColor}
              onValueChange={(color) => {
                useEditorStore.getState().headPainter.setBrushColor(color)
              }}
            />
          </div>

          <div className="flex flex-row items-center gap-2">
            <label className="flex-1 text-end">Layer</label>
            <div className="flex-1">
              <div className="flex w-fit flex-row gap-1 rounded-sm bg-neutral-700 p-1">
                <button
                  className={cn(
                    'rounded-sm px-3 py-1',
                    layer === 'base' && 'bg-blue-500',
                  )}
                  onClick={() => {
                    useEditorStore.getState().headPainter.setLayer('base')
                  }}
                >
                  Base
                </button>
                <button
                  className={cn(
                    'rounded-sm px-3 py-1',
                    layer === 'second' && 'bg-blue-500',
                  )}
                  onClick={() => {
                    useEditorStore.getState().headPainter.setLayer('second')
                  }}
                >
                  Second
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-sm bg-neutral-700 p-1 px-2 text-xs font-bold text-neutral-400">
            Bake textures
          </div>
          <div className="flex flex-col gap-2">
            <div>
              Player heads with painted textures applied need to have their
              textures uploaded as Minecraft skin to use in-game.
            </div>
            {unbakedHeadsCount > 0 ? (
              <>
                <span>
                  There {unbakedHeadsCount === 1 ? 'is' : 'are'}{' '}
                  {unbakedHeadsCount}{' '}
                  {unbakedHeadsCount === 1 ? 'head' : 'heads'} with unbaked
                  texture.
                </span>
                {!mineskinApiKeyFilled && (
                  <span>
                    You need to enter your MineSkin API Key in settings to bake
                    textures.
                  </span>
                )}
                <button
                  className={cn(
                    'rounded-sm bg-stone-700 p-1',
                    !mineskinApiKeyFilled && 'bg-stone-700/50 text-gray-500',
                  )}
                  disabled={!mineskinApiKeyFilled}
                  onClick={() => {
                    useDialogStore.getState().openDialog('bakingPlayerHeads')
                  }}
                >
                  Bake textures
                </button>
              </>
            ) : (
              <span className="text-gray-500">
                All textures used on player heads are baked.
              </span>
            )}
          </div>
        </div>
      </SidePanelContent>
    </SidePanel>
  )
}

export default HeadPainterPanel
