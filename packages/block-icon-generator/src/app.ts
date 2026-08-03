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
