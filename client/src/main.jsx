import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerServiceWorker } from './swUpdate.js'

registerServiceWorker()

const paintError = (msg) => {
  const box = document.createElement('div')
  box.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:#141414;color:#E5484D;font:13px/1.6 monospace;display:flex;align-items:center;justify-content:center;padding:40px;text-align:center;white-space:pre-wrap;word-break:break-all'
  box.textContent = msg
  document.body.appendChild(box)
}
window.addEventListener('error', (e) => paintError('window.error: ' + (e.message || e.error)))
window.addEventListener('unhandledrejection', (e) =>
  paintError('unhandledrejection: ' + (e.reason?.message || e.reason))
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
