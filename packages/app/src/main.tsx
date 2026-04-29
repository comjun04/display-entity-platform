import { enableMapSet } from 'immer'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Cache } from 'three'

import App from './App'
// setup i18n
import './lib/i18n/config.ts'
import './styles/global.css'

// enable immer map/set support
// https://immerjs.github.io/immer/installation#pick-your-immer-version
enableMapSet()

// enable cache for FileLoader in three.js
// https://threejs.org/docs/?q=loader#api/en/loaders/Cache
Cache.enabled = true

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
