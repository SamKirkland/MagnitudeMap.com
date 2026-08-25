import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import { initAnalytics } from './analytics/mixpanel'
import './styles/globals.css'

initAnalytics()

const container = document.getElementById('root')!
const tree = (
  <StrictMode>
    <App />
  </StrictMode>
)

// The build prerenders markup into #root; a dev server / empty shell does not.
if (container.firstChild) {
  hydrateRoot(container, tree)
} else {
  createRoot(container).render(tree)
}
