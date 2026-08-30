import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted, so the layout does not reflow (and clip) on an offline machine,
// a blocked CDN, or a teammate printing a file you emailed them — the stated
// distribution model for these cards. Self-hosting also lets the rasterizer
// inline the fonts same-origin, which is what stops it re-measuring text with a
// fallback stack and silently wrapping a line in the PNG.
import '@fontsource/archivo/400.css'
import '@fontsource/archivo/500.css'
import '@fontsource/archivo/600.css'
import '@fontsource/archivo/700.css'
import '@fontsource/archivo/800.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'

import './styles/app.css'
import { App } from './app/App'
import { startAutosave } from './doc/store'

startAutosave()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
