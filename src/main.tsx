import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

type GtagArgs = [string, ...unknown[]]

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: GtagArgs) => void
  }
}

if (import.meta.env.PROD) {
  // Only inject Google Analytics in production to keep local dev traffic out of reports.
  window.dataLayer = window.dataLayer || []

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-00C5P1KHS4'
  document.head?.appendChild(script)

  const gtag = (...args: GtagArgs) => {
    window.dataLayer.push(args)
  }
  window.gtag = gtag

  gtag('js', new Date())
  gtag('config', 'G-00C5P1KHS4')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
