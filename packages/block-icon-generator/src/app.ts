import { Hono } from 'hono'

import 'dotenv/config'

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

import { fileURLToPath } from 'url'
import open from 'open'
import { parseArgs } from 'util'

const port = parseInt(process.env.PORT ?? '3100')

// parse arguments
const parsedArgs = parseArgs({
  args: process.argv.slice(2),
  options: {
    'no-open': {
      type: 'boolean',
      short: 'n',
      default: false,
    },
  },
})
const OpenBrowserOnStart = !parsedArgs.values['no-open']

// initialize App
const app = new Hono()

// This will eventually be supplied by the job queue.
const jobList = [
  'minecraft:stone',
  'minecraft:grass_block',
  'minecraft:oak_planks',
  'minecraft:diamond_block',
]
const remainingJobs = new Set(jobList)
const completedJobs: string[] = []

app.get('/api/jobs', (c) =>
  c.json({
    remainingJobs: [...remainingJobs],
    completedJobs,
  }),
)

app.post('/api/jobs/:blockId', async (c) => {
  const { blockId } = c.req.param()
  if (!jobList.includes(blockId)) {
    return c.json({ error: 'Unknown job' }, 404)
  }
  if (!remainingJobs.has(blockId)) {
    return c.json({ error: 'Job has already been completed' }, 409)
  }

  const contentType = c.req.header('content-type') ?? ''
  let image: ArrayBuffer

  if (contentType.includes('application/json')) {
    let body: { image?: unknown; imageData?: unknown }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400)
    }

    const encodedImage = body.image ?? body.imageData
    if (typeof encodedImage !== 'string') {
      return c.json({ error: 'Expected a base64 image string' }, 400)
    }

    const base64 = encodedImage.replace(/^data:[^;]+;base64,/, '')
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) {
      return c.json({ error: 'Invalid base64 image data' }, 400)
    }

    image = Uint8Array.from(Buffer.from(base64, 'base64')).buffer
  } else {
    image = await c.req.arrayBuffer()
  }

  if (image.byteLength === 0) {
    return c.json({ error: 'Image data is required' }, 400)
  }

  // TODO: Store the rendered image when a job backend is connected.
  console.log(
    `Received rendered image for ${blockId} (${image.byteLength} bytes)`,
  )

  remainingJobs.delete(blockId)
  completedJobs.push(blockId)

  if (remainingJobs.size === 0) {
    setImmediate(() => {
      console.log('All block icon generation jobs completed.')
      server.close((err) => {
        if (err) {
          console.error(err)
          process.exit(1)
        }
        process.exit(0)
      })
    })
  }

  return c.json({ blockId, received: true }, 202)
})

// frontend
app.use(
  serveStatic({
    root: fileURLToPath(new URL('./../dist', import.meta.url)),
  }),
)

const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Listening on http://localhost:${info.port}`)

    if (OpenBrowserOnStart) {
      // open browser automatically when server is ready
      open(`http://localhost:${info.port}`).catch(console.error)
    }
  },
)

// graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT (Ctrl+C), Shutting down...')
  server.close()
  process.exit(0)
})
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, Gracefully shutting down...')
  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    process.exit(0)
  })
})
