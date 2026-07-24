import { Hono } from 'hono'

import 'dotenv/config'

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

import { fileURLToPath } from 'url'

const port = parseInt(process.env.PORT ?? '3100')

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
