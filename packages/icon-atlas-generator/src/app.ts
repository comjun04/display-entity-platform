import { Hono } from 'hono'

import 'dotenv/config'

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

import { fileURLToPath } from 'url'
import open from 'open'
import { parseArgs } from 'util'
import { resolve as pathResolve, join as pathJoin } from 'path'
import { readFile, stat, writeFile } from 'fs/promises'
import type { IconAtlasGeneratorConfig } from '@depl/shared'
import {
  APIGetJobsResponse,
  APISubmitJobsBody,
  AtlasImageMetadata,
} from './types'
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
) as IconAtlasGeneratorConfig
const jobList = Object.entries(config.items)
  .map(([k, v]) => ({
    id: k,
    ...v,
  }))
  .sort((a, b) => {
    if (a.id < b.id) return -1
    else if (a.id > b.id) return 1
    else return 0
  })

// initialize App
const app = new Hono()
app.use(cors())

app.get('/api/jobs', (c) => {
  console.log(
    'A client fetched the job list. Waiting for the client to submit atlas image data...',
  )
  return c.json<APIGetJobsResponse>({
    targetGameVersion: config.targetGameVersion,
    jobs: jobList,
  })
})

app.post('/api/submit', async (c) => {
  try {
    const { atlasImage: encodedImageDataUrl, iconSize } =
      await c.req.json<APISubmitJobsBody>()

    const atlasImage = Buffer.from(
      encodedImageDataUrl.split(';base64,')[1],
      'base64',
    )

    // write the image
    await writeFile(pathJoin(OutputDirPath, 'icon-atlas.png'), atlasImage)

    // write metadata
    const metadata: AtlasImageMetadata = {
      items: jobList.map((job) => job.id),
      iconSize,
    }
    await writeFile(
      pathJoin(OutputDirPath, 'icon-atlas.metadata.json'),
      JSON.stringify(metadata),
    )

    console.log(
      'Received submission from client. Shutting down the generator server...',
    )

    // shutdown after response is sent
    setTimeout(shutdown, 1000)

    return c.json({ result: 'success' })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Invalid body' }, 400)
  }
})

// api fallback
app.all('/api/*', (c) => c.json({ error: 'Not Found' }, 404))

// frontend
const frontendDistFolderPath = fileURLToPath(
  new URL('./../dist', import.meta.url),
)
app.use(
  serveStatic({
    root: frontendDistFolderPath,
  }),
)
// print warning if frontend prod build not found
if (!(await stat(frontendDistFolderPath)).isDirectory()) {
  console.warn(
    'Warning: Cannot find production build for frontend. Page opened from this server will not work.',
  )
}

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

function shutdown() {
  server.close()
}
