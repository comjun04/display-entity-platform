import type {
  MineSkinAPIV2_ListQueueJobsResponse,
  MineSkinAPIV2_QueueJobDetailResponse,
  MineSkinAPIV2_QueueSkinGenerationResponse,
} from '@/types/base'
import type {
  HeadBakerWorkerMessage,
  HeadBakerWorkerResponse,
} from '@/types/workers'

interface QueueItem {
  entityId: string
  image: Blob
}

interface ActiveJob {
  jobId: string
  entityIds: Set<string>
}

type HeadState =
  | {
      entityId: string
      status: 'queued'
    }
  | {
      entityId: string
      status: 'generating'
    }
  | {
      entityId: string
      status: 'completed'
      generatedData: {
        skinUrl: string
      }
    }
  | {
      entityId: string
      status: 'error'
    }

const MAX_CONCURRENT = 10
const POLL_INTERVAL_MS = 1000

const headState = new Map<string, HeadState>()

const pendingQueue: QueueItem[] = []
const activeJobs = new Map<string, ActiveJob>() // jobId -> job

let apiKey = ''
let workerRunning = false
let pollerRunning = false

function log(...content: unknown[]) {
  console.log('[worker:headBaker]', ...content)
}

const USER_AGENT = `display-entity-platform/${__VERSION__} (${import.meta.env.VITE_WORKER_USERAGENT_BROADCAST_URL})`
function getRequestHeaders() {
  return {
    'User-Agent': USER_AGENT,
    'MineSkin-User-Agent': USER_AGENT, // `User-Agent` is not changeable on browsers, so use custom header
    Authorization: `Bearer ${apiKey}`,
  }
}

// Utility: pixels -> PNG Blob
async function pixelsToPNG(pixels: number[]): Promise<Blob> {
  const size = 64
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')!

  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(pixels), size, size),
    0,
    0,
  )

  return canvas.convertToBlob({ type: 'image/png' })
}

// Helper: Emit Incremental Update
function emitUpdate(updated: HeadState[]) {
  if (updated.length === 0) return

  const stats = {
    total: headState.size,
    generating: 0,
    error: 0,
    completed: 0,
  }
  for (const state of headState.values()) {
    switch (state.status) {
      case 'generating':
        stats.generating++
        break
      case 'error':
        stats.error++
        break
      case 'completed':
        stats.completed++
        break
    }
  }

  self.postMessage({
    type: 'update',
    stats,
    heads: updated,
  } satisfies HeadBakerWorkerResponse)
}

// Submit Job (only when slot available)
async function submitJob(item: QueueItem) {
  const formData = new FormData()
  formData.append('file', item.image)
  formData.append('visibility', 'unlisted')

  const res = await fetch('https://api.mineskin.org/v2/queue', {
    method: 'POST',
    headers: getRequestHeaders(),
    body: formData,
  }).then((r) => r.json() as Promise<MineSkinAPIV2_QueueSkinGenerationResponse>)

  if (!res.success) {
    headState.set(item.entityId, {
      entityId: item.entityId,
      status: 'error',
    })

    emitUpdate([
      {
        entityId: item.entityId,
        status: 'error',
      },
    ])

    return
  }

  if (res.skin != null) {
    // the skin for this custom head was already generated and ready to use
    // TODO: switch to completed
    headState.set(item.entityId, {
      entityId: item.entityId,
      status: 'completed',
      generatedData: { skinUrl: res.skin.texture.url.skin },
    })
    emitUpdate([
      {
        entityId: item.entityId,
        status: 'completed',
        generatedData: { skinUrl: res.skin.texture.url.skin },
      },
    ])
    return
  }

  const existingJob = activeJobs.get(res.job.id)
  if (existingJob != null) {
    existingJob.entityIds.add(item.entityId)
  } else {
    activeJobs.set(res.job.id, {
      jobId: res.job.id,
      entityIds: new Set([item.entityId]),
    })
  }

  headState.set(item.entityId, {
    entityId: item.entityId,
    status: 'generating',
  })

  emitUpdate([
    {
      entityId: item.entityId,
      status: 'generating',
    },
  ])
}

// Fetch Job Detail (single job)
async function fetchJobSkinUrl(jobId: string) {
  const res = await fetch(`https://api.mineskin.org/v2/queue/${jobId}`, {
    headers: getRequestHeaders(),
  }).then((r) => r.json() as Promise<MineSkinAPIV2_QueueJobDetailResponse>)

  if (!res.success) {
    console.error(res.errors)
    throw new Error('Failed to fetch job skin url')
  }
  const skinUrl = res.skin.texture.url.skin
  return skinUrl
}

// Scheduler (fills up to `MAX_CONCURRENT` jobs)
async function schedule() {
  const count = Math.max(
    Math.min(MAX_CONCURRENT - activeJobs.size, pendingQueue.length),
    0,
  ) // 0 < available slot count < pendingQueue.length
  log(`schedule(): adding ${count} new jobs to the queue`)
  const items = pendingQueue.slice(0, count)
  // submit job at the same time to reduce delay between api requests
  await Promise.allSettled(items.map((item) => submitJob(item)))
  pendingQueue.splice(0, count)

  if (!pollerRunning) {
    pollerRunning = true
    await pollLoop()
  }
}

// Central Poller (single loop)
async function pollLoop() {
  while (activeJobs.size > 0 || pendingQueue.length > 0) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

    const res = await fetch('https://api.mineskin.org/v2/queue', {
      headers: getRequestHeaders(),
    }).then((r) => r.json() as Promise<MineSkinAPIV2_ListQueueJobsResponse>)

    for (const job of res.jobs) {
      if (!activeJobs.has(job.id)) continue

      const jobDetail = activeJobs.get(job.id)!

      if (job.status === 'completed') {
        activeJobs.delete(job.id)

        try {
          // fetch actual generated skin data
          const skinUrl = await fetchJobSkinUrl(job.id)

          const updatedHeadStateList = [...jobDetail.entityIds.values()].map(
            (entityId) => ({
              entityId,
              status: 'completed' as const,
              generatedData: {
                skinUrl,
              },
            }),
          )

          for (const state of updatedHeadStateList) {
            headState.set(state.entityId, state)
          }

          emitUpdate(updatedHeadStateList)
        } catch (err) {
          console.error(err)

          const updatedHeadStateList = [...jobDetail.entityIds.values()].map(
            (entityId) => ({
              entityId,
              status: 'error' as const,
            }),
          )

          for (const state of updatedHeadStateList) {
            headState.set(state.entityId, state)
          }

          emitUpdate(updatedHeadStateList)
        }
      }

      if (job.status === 'failed') {
        activeJobs.delete(job.id)

        const updatedHeadStateList = [...jobDetail.entityIds.values()].map(
          (entityId) => ({
            entityId,
            status: 'error' as const,
          }),
        )

        for (const state of updatedHeadStateList) {
          headState.set(state.entityId, state)
        }

        emitUpdate(updatedHeadStateList)
      }
    }

    // refill slots
    await schedule()
  }

  pollerRunning = false

  if (pendingQueue.length < 1) {
    const finishedHeads = [...headState.values()].filter(
      (head) => head.status === 'completed' || head.status === 'error',
    )
    if (finishedHeads.length !== headState.size) {
      throw new Error(
        `Unexpected unprocessed ${headState.size - finishedHeads.length} heads found`,
      )
    }

    self.postMessage({
      type: 'done',
      heads: finishedHeads,
    } satisfies HeadBakerWorkerResponse)
  }
}

// Worker Message Handler
self.onmessage = async (evt: MessageEvent<HeadBakerWorkerMessage>) => {
  const msg = evt.data
  if (msg.cmd !== 'run') return

  if (workerRunning) {
    console.error('worker already running')
    return
  }
  workerRunning = true
  log('starting, total heads:', msg.heads.length)

  apiKey = msg.mineskinApiKey

  for (const head of msg.heads) {
    const image = await pixelsToPNG(head.texturePixels)

    pendingQueue.push({
      entityId: head.entityId,
      image,
    })

    headState.set(head.entityId, {
      entityId: head.entityId,
      status: 'queued',
    })
  }
  log('finished transforming custom head skin pixels to png images')

  await schedule()
}
