import { type FC, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/shallow'

import { getLogger } from '@/lib/logger'
import { useDialogStore } from '@/stores/dialogStore'
import { useDisplayEntityStore } from '@/stores/displayEntityStore'
import { useEditorStore } from '@/stores/editorStore'
import { isItemDisplayPlayerHead } from '@/types/guards'
import type {
  HeadBakerWorkerMessage,
  HeadBakerWorkerResponse,
} from '@/types/workers'

import { MultiSegmentProgress } from '../ui/MultiSegmentProgress'
import Dialog from './Dialog'

const logger = getLogger('PlayerHeadBakingDialog')

const PlayerHeadBakingDialog: FC = () => {
  const { isOpen, closeActiveDialog } = useDialogStore(
    useShallow((state) => ({
      isOpen: state.activeDialog === 'bakingPlayerHeads',
      closeActiveDialog: state.closeActiveDialog,
    })),
  )

  const [running, setRunning] = useState(false)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({
    generating: 0,
    error: 0,
    completed: 0,
  })

  const workerRef = useRef<Worker>()
  useEffect(() => {
    if (isOpen) {
      workerRef.current = new Worker(
        new URL('../../workers/headBaker.worker.ts', import.meta.url),
        { type: 'module' },
      )

      const unbakedHeads = [
        ...useDisplayEntityStore.getState().entities.values(),
      ]
        .map((entity) => {
          const headPixels =
            isItemDisplayPlayerHead(entity) &&
            entity.playerHeadProperties.texture?.baked === false
              ? entity.playerHeadProperties.texture.paintTexturePixels
              : null
          if (headPixels == null) return null

          return {
            entityId: entity.id,
            texturePixels: headPixels,
          }
        })
        .filter((d) => d != null)
      setTotal(unbakedHeads.length)
      // reset stats
      setStats({
        generating: 0,
        error: 0,
        completed: 0,
      })

      const { setItemDisplayPlayerHeadProperties } =
        useDisplayEntityStore.getState()

      workerRef.current?.postMessage({
        cmd: 'run',
        mineskinApiKey:
          useEditorStore.getState().settings.headPainter.mineskinApiKey,
        heads: unbakedHeads,
      } satisfies HeadBakerWorkerMessage)
      setRunning(true)

      workerRef.current?.addEventListener(
        'message',
        (evt: MessageEvent<HeadBakerWorkerResponse>) => {
          const data = evt.data
          logger.debug('incoming worker message', data)

          if (data.type === 'update') {
            data.heads
              .filter((headData) => headData.status === 'completed')
              .forEach((headData) => {
                setItemDisplayPlayerHeadProperties(headData.entityId, {
                  texture: {
                    baked: true,
                    url: headData.generatedData.skinUrl,
                  },
                })
              })

            setStats({
              generating: data.stats.generating,
              error: data.stats.error,
              completed: data.stats.completed,
            })
          } else if (data.type === 'done') {
            setRunning(false)
          }
        },
      )
    }

    return () => {
      workerRef.current?.terminate()
    }
  }, [isOpen])

  const headsWaitingInQueue =
    total - stats.generating - stats.error - stats.completed

  return (
    <Dialog
      title="Baking Player Heads..."
      useLargeStaticSize={false}
      disableUserClose={running}
      open={isOpen}
      onClose={closeActiveDialog}
    >
      <MultiSegmentProgress
        segments={[
          {
            id: 'completed',
            value: stats.completed,
            className: 'bg-green-700',
          },
          {
            id: 'error',
            value: stats.error,
            className: 'bg-red-800',
          },
          {
            id: 'generating',
            value: stats.generating,
            className: 'bg-yellow-800',
          },
          {
            id: 'queued',
            value: headsWaitingInQueue,
            className: 'bg-gray-700',
          },
        ]}
        normalize
      />

      <div className="flex flex-col gap-1">
        <div>
          <span>Total: {total}</span>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
          <div className="flex flex-row items-center gap-2">
            <div className="h-4 w-12 rounded-sm bg-gray-700" />
            <span>Waiting: {headsWaitingInQueue}</span>
          </div>
          <div className="flex flex-row items-center gap-2">
            <div className="h-4 w-12 rounded-sm bg-yellow-700" />
            <span>Generating: {stats.generating}</span>
          </div>
          <div className="flex flex-row items-center gap-2">
            <div className="h-4 w-12 rounded-sm bg-red-800" />
            <span>Error: {stats.error}</span>
          </div>
          <div className="flex flex-row items-center gap-2">
            <div className="h-4 w-12 rounded-sm bg-green-800" />
            <span>Completed: {stats.completed}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-row justify-end gap-2">
        <button
          className="rounded-sm bg-red-700 px-3 py-2 transition disabled:opacity-30"
          disabled={!running}
          onClick={() => {
            workerRef.current?.terminate()
            setRunning(false)
          }}
        >
          Cancel
        </button>
        <button
          className="rounded-sm bg-gray-700 px-3 py-2 transition disabled:opacity-30"
          disabled={running}
          onClick={closeActiveDialog}
        >
          Close
        </button>
      </div>
    </Dialog>
  )
}

export default PlayerHeadBakingDialog
