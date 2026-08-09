import { Hono } from 'hono'

import 'dotenv/config'

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

import { fileURLToPath } from 'url'
import open from 'open'
import { parseArgs } from 'util'
import { resolve as pathResolve } from 'path'
import { readFile } from 'fs/promises'
import type { BlockIconGeneratorConfig } from '@depl/shared'
import { APIGetJobsResponse } from './types'
import { cors } from 'hono/cors'

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
    config: {
      type: 'string',
      short: 'c',
      default: '',
    },
    'out-dir': {
      type: 'string',
      short: 'o',
      default: '',
    },
  },
})
const OpenBrowserOnStart = !parsedArgs.values['no-open']
const ConfigFilePath = pathResolve(parsedArgs.values.config)
const OutputDirPath = pathResolve(parsedArgs.values['out-dir'])

// read config
const config = JSON.parse(
  await readFile(ConfigFilePath, 'utf8'),
) as BlockIconGeneratorConfig
const jobList = Object.entries(config.items).map(([k, v]) => ({
  id: k,
  ...v,
}))

const remainingJobs = new Set(jobList)
const completedJobs: string[] = []

// initialize App
const app = new Hono()
app.use(cors())

app.get('/api/jobs', (c) =>
  c.json<APIGetJobsResponse>({
    targetGameVersion: config.targetGameVersion,
    jobs: jobList,
  }),
)

app.post('/api/submit', async (c) => {
  let body: { image?: unknown; imageData?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
})

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

// api fallback
app.all('/api/*', (c) => c.json({ error: 'Not Found' }, 404))

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
